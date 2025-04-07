// src/xsdGenerator.test.js

// --- Mock DOMParser Setup ---
class MockDOMNode {
    constructor(nodeType) {
        this.nodeType = nodeType; // 1 = ELEMENT_NODE, 3 = TEXT_NODE, 9 = DOCUMENT_NODE
        this.childNodes = [];
        this._attributesMap = new Map(); // Internal storage for attributes
        this.textContent = ''; // Approximated text content
        this.tagName = ''; // For element nodes
        this.nodeValue = null; // For text nodes
        this.documentElement = null; // For document node
        this._isError = false; // Flag specifically for parser errors
        this.errorContent = '';
    }

    appendChild(child) {
        this.childNodes.push(child);
        // Update textContent approx
        if (child.nodeType === 3) {
            this.textContent += child.nodeValue;
        } else if (child.nodeType === 1) {
            // Simple concat; more accurate requires traversal
            this.textContent += child.textContent;
        }
    }

    // Helper to simulate querySelector for parsererror
    querySelector(selector) {
        if (selector === 'parsererror' && this._isError) {
            // Mimic the structure used in the actual code
            return { textContent: this.errorContent || 'Simulated parser error\nDetails here' };
        }
        return null;
    }

    // Getter for attributes, mimicking NamedNodeMap iteration
    get attributes() {
        const attrs = this._attributesMap;
        const attrArray = Array.from(attrs.values());
        // Make it behave somewhat like NamedNodeMap (has length, iterable)
        Object.defineProperty(attrArray, 'length', {
            value: attrs.size,
            writable: false
        });
        // Add indexed access (simplification)
        Array.from(attrs.keys()).forEach((key, i) => attrArray[i] = attrs.get(key));
        return attrArray;
    }

    // Internal method to add attributes during mock parsing
    _addAttribute(name, value) {
        const attrNode = { name: name, value: value };
        this._attributesMap.set(name, attrNode);
    }
}

global.DOMParser = class {
    parseFromString(str, type) {
        const doc = new MockDOMNode(9); // Always create the base document node

        // --- Handle Empty/Invalid Input BEFORE trying to parse ---
        // These cases result in no documentElement, NOT a parser error node
        if (!str || typeof str !== 'string' || !str.trim() || str.trim() === `<?xml version="1.0"?><!-- Just a comment -->`) {
            return doc; // Return doc with documentElement still null
        }

        // --- Handle Explicit Parser Error Simulation ---
        if (str.includes('<parsererror>')) {
            doc._isError = true; // SET error flag ONLY for this case
            const match = str.match(/<parsererror>([\s\S]*?)<\/parsererror>/);
            doc.errorContent = match ? match[1].trim() : 'Simulated parser error\nDetails here';
            return doc; // Return doc flagged as error
        }
        // --- End Special Case Handling ---

        // --- Proceed with parsing for valid-looking XML strings ---
        try {
            const elementRegex = /<(\/?)\s*([\w:\-]+)\s*([^>]*?)(\/?)>/g; // Handles tags, attributes, self-closing
            const stack = [doc];
            let currentParent = doc;
            let lastIndex = 0;
            let match;

            while ((match = elementRegex.exec(str)) !== null) {
                const [fullMatch, slash, tagName, attrsStr, selfCloseMarker] = match;

                // --- Add Text Node ---
                if (match.index > lastIndex) {
                    const textContent = str.substring(lastIndex, match.index).trim();
                    if (textContent && currentParent && currentParent.nodeType !== 9) {
                        const textNode = new MockDOMNode(3); textNode.nodeValue = textContent; currentParent.appendChild(textNode);
                    }
                }

                if (!slash) { // --- Opening tag or self-closing tag ---
                    const elementNode = new MockDOMNode(1); elementNode.tagName = tagName;
                    const attrRegex = /([\w:\-]+)\s*=\s*"(.*?)"/g; let attrMatch;
                    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) { elementNode._addAttribute(attrMatch[1], attrMatch[2]); } // Use internal method

                    if (currentParent) { currentParent.appendChild(elementNode); }
                    if (currentParent === doc) { doc.documentElement = elementNode; } // Set root element

                    const isSelfClosing = selfCloseMarker === '/' || attrsStr.trim().endsWith('/');
                    if (!isSelfClosing) { stack.push(elementNode); currentParent = elementNode; }

                } else { // --- Closing tag </tag> ---
                    if (stack.length > 1 && stack[stack.length - 1].tagName === tagName) {
                        const closedNode = stack.pop(); currentParent = stack[stack.length - 1];
                        // Approx text content
                        closedNode.textContent = closedNode.childNodes.filter(n => n.nodeType === 3).map(n => n.nodeValue).join('');
                    } else {
                        // Mismatched tag is a real parser error
                        doc._isError = true; doc.errorContent = `Parsing error\nMismatched closing tag ${tagName}`; return doc;
                    }
                }
                lastIndex = elementRegex.lastIndex;
            }

            // --- Handle any trailing text after the last tag ---
            if (str.length > lastIndex) {
                const trailingText = str.substring(lastIndex).trim();
                if (trailingText && currentParent && currentParent.nodeType !== 9) {
                    const textNode = new MockDOMNode(3); textNode.nodeValue = trailingText; currentParent.appendChild(textNode);
                }
            }
            // If parsing completes but we never found a root element
            if (!doc.documentElement) {
                // The initial checks catch most 'no root' cases.
                return doc; // Return doc with null documentElement
            }

        } catch (e) {
            console.error("Mock Parsing Failed Exception:", e);
            doc._isError = true; // Mark as error on unexpected exception
            doc.errorContent = "Mock parser failed\nInternal error during regex parsing";
        }

        return doc; // Return the successfully parsed (or partially parsed) doc
    }
};
// --- End Mock Setup ---

// --- Test Suite ---
import { generateXsd } from './xsdGenerator'; // Import AFTER mock setup

describe('xsdGenerator', () => {

    // Suppress console.error specifically for the test where we expect it
    let errorSpy;
    beforeEach(() => {
        // Hide expected console errors during specific tests
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        // Restore console.error after each test
        errorSpy.mockRestore();
    });

    it('should generate XSD for a simple XML', () => {
        const xml = `<root><item>Data</item></root>`;
        const result = generateXsd(xml);
        expect(result).toContain('<xs:element name="root" type="tns:rootType"/>');
        expect(result).toContain('<xs:element name="item" type="xs:string"/>');
        expect(result).toContain('<xs:complexType name="rootType">');
        expect(result).toContain('<xs:element ref="tns:item" minOccurs="0" maxOccurs="unbounded"/>');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should handle attributes', () => {
        const xml = `<product id="123" available="true"><name>Widget</name></product>`;
        const result = generateXsd(xml);
        expect(result).toContain('<xs:element name="product" type="tns:productType"/>');
        expect(result).toContain('<xs:element name="name" type="xs:string"/>');
        expect(result).toContain('<xs:complexType name="productType">');
        expect(result).toContain('<xs:element ref="tns:name" minOccurs="0" maxOccurs="unbounded"/>');
        expect(result).toContain('<xs:attribute name="id" type="xs:string" use="optional"/>');
        expect(result).toContain('<xs:attribute name="available" type="xs:string" use="optional"/>');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should handle nested elements', () => {
        const xml = `<order><customer><id>C1</id></customer><items><item>I1</item></items></order>`;
        const result = generateXsd(xml);
        expect(result).toContain('<xs:element name="order" type="tns:orderType"/>');
        expect(result).toContain('<xs:element name="customer" type="tns:customerType"/>');
        expect(result).toContain('<xs:element name="items" type="tns:itemsType"/>');
        expect(result).toContain('<xs:complexType name="orderType">');
        expect(result).toContain('<xs:element ref="tns:customer" minOccurs="0" maxOccurs="unbounded"/>');
        expect(result).toContain('<xs:element ref="tns:items" minOccurs="0" maxOccurs="unbounded"/>');
        expect(result).toContain('<xs:element name="id" type="xs:string"/>');
        expect(result).toContain('<xs:element name="item" type="xs:string"/>');
        expect(result).toContain('<xs:complexType name="customerType">');
        expect(result).toContain('<xs:element ref="tns:id" minOccurs="0" maxOccurs="unbounded"/>');
        expect(result).toContain('<xs:complexType name="itemsType">');
        expect(result).toContain('<xs:element ref="tns:item" minOccurs="0" maxOccurs="unbounded"/>');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should handle repeated elements correctly', () => {
        const xml = `<list><value>A</value><value>B</value></list>`;
        const result = generateXsd(xml);
        expect(result).toContain('<xs:element name="list" type="tns:listType"/>');
        expect(result).toContain('<xs:element name="value" type="xs:string"/>');
        expect(result).toContain('<xs:complexType name="listType">');
        expect(result).toContain('<xs:element ref="tns:value" minOccurs="0" maxOccurs="unbounded"/>');
        expect(result.match(/<xs:element name="value"/g)?.length).toBe(1);
        expect(result).not.toContain('name="valueType"');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should handle elements with only text content', () => {
        const xml = `<message>Hello World</message>`;
        const result = generateXsd(xml);
        expect(result).toContain('<xs:element name="message" type="xs:string"/>');
        expect(result).not.toContain('<xs:complexType name="messageType">');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should handle empty elements (self-closing)', () => {
        const xml = `<data><emptyElement/></data>`;
        const result = generateXsd(xml);
        expect(result).toContain('<xs:element name="data" type="tns:dataType"/>');
        expect(result).toContain('<xs:element name="emptyElement" type="tns:emptyElementType"/>');
        expect(result).toContain('<xs:complexType name="emptyElementType">');
        expect(result).toContain('<xs:sequence minOccurs="0"/>');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should handle elements with attributes but only text content (simpleContent)', () => {
        const xml = `<measurement unit="cm">150</measurement>`;
        const result = generateXsd(xml);
        expect(result).toContain('<xs:element name="measurement" type="tns:measurementType"/>');
        expect(result).toContain('<xs:complexType name="measurementType">');
        expect(result).toContain('<xs:simpleContent>');
        expect(result).toContain('<xs:extension base="xs:string">');
        expect(result).toContain('<xs:attribute name="unit" type="xs:string" use="optional"/>');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should handle elements with attributes but no content (empty)', () => {
        const xml = `<config active="false"/>`;
        const result = generateXsd(xml);
        expect(result).toContain('<xs:element name="config" type="tns:configType"/>');
        expect(result).toContain('<xs:complexType name="configType">');
        expect(result).toContain('<xs:attribute name="active" type="xs:string" use="optional"/>');
        expect(result).toContain('<xs:sequence minOccurs="0"/>');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should handle mixed content', () => {
        const xml = `<description>This item is <highlight>very</highlight> important.</description>`;
        const result = generateXsd(xml);
        expect(result).toContain('<xs:element name="description" type="tns:descriptionType"/>');
        expect(result).toContain('<xs:element name="highlight" type="xs:string"/>');
        expect(result).toContain('<xs:complexType name="descriptionType" mixed="true">');
        expect(result).toContain('<xs:sequence>');
        expect(result).toContain('<xs:element ref="tns:highlight" minOccurs="0" maxOccurs="unbounded"/>');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should throw an error for invalid XML (simulated parser error)', () => {
        const parserErrorXml = '<parsererror>Simulated error\nDetails here</parsererror>';
        // Mock sets _isError flag; code checks querySelector('parsererror') and then textContent
        expect(() => generateXsd(parserErrorXml)).toThrow(/Invalid XML: Details here/);
        // Check that the specific console error from generateXsd was logged
        expect(errorSpy).toHaveBeenCalledWith("XML Parsing Error:", expect.objectContaining({ textContent: expect.stringContaining('Details here') }));
    });

    it('should throw an error for empty input string', () => {
        // Mock now returns doc with documentElement: null and _isError: false
        // Code checks rootElement after parserError check
        expect(() => generateXsd('')).toThrow(/Invalid XML: No root element found./);
        // Verify no console error was logged because it's not a parser error
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should throw an error if no root element is found (comment only)', () => {
        const noRootXml = `<?xml version="1.0"?><!-- Just a comment -->`;
        // Mock now returns doc with documentElement: null and _isError: false
        expect(() => generateXsd(noRootXml)).toThrow(/Invalid XML: No root element found./);
        // Verify no console error was logged
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should use placeholder namespaces', () => {
        const xml = `<data><value>1</value></data>`;
        const result = generateXsd(xml);
        expect(result).toContain('xmlns:xs="http://www.w3.org/2001/XMLSchema"');
        expect(result).toContain('targetNamespace="http://example.com/generatedSchema"');
        expect(result).toContain('xmlns:tns="http://example.com/generatedSchema"');
        expect(errorSpy).not.toHaveBeenCalled();
    });
});