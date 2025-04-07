/**
 * Parses XML and generates a best-effort XSD schema string.
 * All types are set to xs:string, occurrences are unbounded.
 *
 * @param {string} xmlString The XML content as a string.
 * @returns {string} The generated XSD schema as a string.
 * @throws {Error} If XML parsing fails.
 */
export function generateXsd(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
        console.error("XML Parsing Error:", parserError);
        throw new Error(`Invalid XML: ${parserError.textContent.split("\n")[1] || 'Parsing failed.'}`);
    }

    const rootElement = xmlDoc.documentElement;
    if (!rootElement) {
        throw new Error("Invalid XML: No root element found.");
    }

    const elementInfo = new Map(); // Stores { elementName: { attributes: Set<string>, children: Set<string>, hasTextContent: boolean } }
    const elementOrder = new Map(); // Stores { elementName: string[] } to maintain child order within first occurrence

    function processNode(node, parentName = null) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            // Check if parent might have text content alongside elements (mixed)
            if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '' && parentName && elementInfo.has(parentName)) {
                elementInfo.get(parentName).hasTextContent = true;
            }
            return;
        }

        const elementName = node.tagName;
        if (!elementInfo.has(elementName)) {
            elementInfo.set(elementName, {
                attributes: new Set(),
                children: new Set(),
                hasTextContent: false, // Initialize text content flag
            });
            elementOrder.set(elementName, []); // Initialize order array only once
        }

        const info = elementInfo.get(elementName);
        const order = elementOrder.get(elementName);
        const childrenProcessedInThisNode = new Set(); // Track children added in this specific node visit


        // Process Attributes
        if (node.attributes) {
            for (let i = 0; i < node.attributes.length; i++) {
                info.attributes.add(node.attributes[i].name);
            }
        }

        // Process Child Nodes (Elements and Text)
        let hasChildElements = false;
        node.childNodes.forEach(childNode => {
            if (childNode.nodeType === Node.ELEMENT_NODE) {
                hasChildElements = true;
                const childName = childNode.tagName;
                // Add to overall children set for the element type
                info.children.add(childName);
                // Add to order *only if* this is the first time we see this child for this parent *type*
                // and only capture the order from the first instance of the parent element encountered
                if (elementOrder.get(elementName).length === 0 || !elementOrder.get(elementName).includes(childName)) {
                    if (!childrenProcessedInThisNode.has(childName) && elementOrder.get(elementName).length === 0) { // Rough way to capture first instance order
                        order.push(childName);
                        childrenProcessedInThisNode.add(childName); // Track within this specific node
                    } else if (!elementOrder.get(elementName).includes(childName)) {
                        // If order was already partially captured but this child is new, add it
                        order.push(childName);
                    }
                }
                // Recurse
                processNode(childNode, elementName);
            } else if (childNode.nodeType === Node.TEXT_NODE && childNode.nodeValue.trim() !== '') {
                info.hasTextContent = true; // Mark if any text content exists
            }
        });

        // If an element only ever contains text and no child elements, mark it
        if (info.hasTextContent && !hasChildElements && info.children.size === 0) {
            // This might be refined - could still have attributes
        } else if (!info.hasTextContent && !hasChildElements) {
            // Potentially empty element
        }
    }

    processNode(rootElement);

    // --- Generate XSD String ---
    let xsdString = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xsdString += `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"\n`;
    xsdString += `           targetNamespace="http://example.com/generatedSchema"\n`; // Placeholder namespace
    xsdString += `           xmlns:tns="http://example.com/generatedSchema"\n`;      // Placeholder namespace
    xsdString += `           elementFormDefault="qualified">\n\n`;

    // Define global elements first
    xsdString += `  <!-- Global Element Declarations -->\n`;
    for (const elementName of elementInfo.keys()) {
        const info = elementInfo.get(elementName);
        // Determine type: simple string if no children/attributes, otherwise complex type
        const hasChildren = info.children.size > 0;
        const hasAttributes = info.attributes.size > 0;

        if (!hasChildren && !hasAttributes && info.hasTextContent) {
            // Simple element with only text content
            xsdString += `  <xs:element name="${elementName}" type="xs:string"/>\n`;
        } else {
            // Element likely needs a complex type (has children, attributes, or could be empty)
            xsdString += `  <xs:element name="${elementName}" type="tns:${elementName}Type"/>\n`;
        }
    }
    xsdString += `\n`;


    // Define complex types
    xsdString += `  <!-- Complex Type Definitions -->\n`;
    for (const [elementName, info] of elementInfo.entries()) {
        const hasChildren = info.children.size > 0;
        const hasAttributes = info.attributes.size > 0;

        // Only define complex type if needed (i.e., not handled by simple xs:string above)
        if (hasChildren || hasAttributes || (!info.hasTextContent && !hasChildren && !hasAttributes)) { // Include empty elements case
            const isMixed = info.hasTextContent && hasChildren; // Check if element has both text and child elements

            xsdString += `  <xs:complexType name="${elementName}Type"${isMixed ? ' mixed="true"' : ''}>\n`;

            if (hasChildren) {
                xsdString += `    <xs:sequence>\n`;
                // Use the captured order if available, otherwise just iterate through the set
                const childrenOrder = elementOrder.get(elementName) || [...info.children];
                // Ensure all children from the set are included, even if not in the initial order capture
                const allChildren = new Set([...childrenOrder, ...info.children]);

                for (const childName of allChildren) {
                    xsdString += `      <xs:element ref="tns:${childName}" minOccurs="0" maxOccurs="unbounded"/>\n`;
                }
                xsdString += `    </xs:sequence>\n`;
            } else if (!hasChildren && !info.hasTextContent) {
                // Allows element to be empty if it has no children/text but might have attributes
                xsdString += `    <xs:sequence minOccurs="0"/>\n` // Or potentially omit sequence if attributes handle content
            }
            // If the element ONLY has text content but also attributes, it needs simpleContent extension
            else if (info.hasTextContent && !hasChildren && hasAttributes) {
                xsdString = xsdString.replace(` name="${elementName}Type"${isMixed ? ' mixed="true"' : ''}>`, ` name="${elementName}Type">`); // Remove mixed if it was added
                xsdString += `    <xs:simpleContent>\n`;
                xsdString += `      <xs:extension base="xs:string">\n`;
                // Add attributes inside extension
                for (const attrName of info.attributes) {
                    xsdString += `        <xs:attribute name="${attrName}" type="xs:string" use="optional"/>\n`;
                }
                xsdString += `      </xs:extension>\n`;
                xsdString += `    </xs:simpleContent>\n`;
                xsdString += `  </xs:complexType>\n\n`;
                continue; // Skip standard attribute handling below for this case
            }

            // Add attributes (if not handled by simpleContent above)
            for (const attrName of info.attributes) {
                xsdString += `    <xs:attribute name="${attrName}" type="xs:string" use="optional"/>\n`;
            }

            xsdString += `  </xs:complexType>\n\n`;
        }
    }

    xsdString += `</xs:schema>\n`;

    return xsdString;
}