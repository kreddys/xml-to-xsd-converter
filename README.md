# React XML to XSD Converter

A web-based user interface built with React that allows users to paste or upload an XML file and generate a best-effort XSD (XML Schema Definition) based on the structure and attributes found in the provided XML.

The generated XSD uses `xs:string` for all data types and flexible occurrence indicators, providing a basic schema estimate derived from a single XML instance.

**(Optional: Add a Screenshot Here)**
<!-- ![Screenshot of the XML to XSD Converter UI](./screenshot.png) -->
<!-- (Replace with an actual path to your screenshot if you add one) -->

## Features

* **Paste XML:** Directly paste XML content into a text area.
* **Upload XML:** Upload `.xml` files via a file input.
* **Best-Effort Conversion:** Parses the input XML and generates a corresponding XSD structure.
  * Identifies unique XML elements.
  * Detects attributes associated with each element.
  * Maps parent-child element relationships.
  * Attempts to preserve element order within sequences based on first occurrence.
* **Simple XSD Typing:** Defines all elements and attributes with `type="xs:string"`.
* **Flexible Occurrences:** Uses `minOccurs="0"` and `maxOccurs="unbounded"` for child elements and `use="optional"` for attributes for maximum flexibility based on a single sample.
* **Copy to Clipboard:** Easily copy the generated XSD schema.
* **Download XSD:** Download the generated schema as a `.xsd` file.
* **Loading Indicator:** Shows processing status during conversion.
* **Error Handling:** Displays user-friendly messages for invalid XML or conversion errors.
* **Responsive UI:** Clean and professional interface.

## Technology Stack

* **Frontend:** React
* **Parsing:** Browser's native `DOMParser` API
* **Styling:** CSS
* **Testing:** Jest, React Testing Library

## Prerequisites

* Node.js (v16.x or later recommended)
* npm (v8.x or later) or yarn (v1.22.x or later)

## Installation & Setup

1. **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory-name>
    ```
2. **Install dependencies:**
    ```bash
    npm install
    ```
    or
    ```bash
    yarn install
    ```

## Running the Application (Development)

1. **Start the development server:**
    ```bash
    npm start
    ```
    or
    ```bash
    yarn start
    ```
2. Open your web browser and navigate to `http://localhost:3000` (or the port indicated in the console).

## Running Tests

To run the automated tests for both the conversion logic and the UI components:

```bash
npm test
```
OR
```bash
yarn test
```

This will launch Jest in watch mode. Press `a` to run all tests.

## How It Works

**Input:** The user provides XML via pasting or file upload.

**Parsing:** The application uses the browser's `DOMParser` to parse the XML string into a DOM tree. Basic validation occurs during this step.

**Analysis:** The code recursively traverses the DOM tree (`src/xsdGenerator.js`). It keeps track of:

- Unique element names encountered.
- Attributes found on each unique element type.
- Parent-child relationships.
- Whether an element type contains text content, child elements, or both (mixed content).
- The order of child elements within the first instance of a parent element type.

**XSD Generation:** Based on the analysis, an XSD schema string is constructed:

- A standard `xs:schema` structure is created with placeholder namespaces.
- Global `xs:element` declarations are created for each unique element found.
- `xs:complexType` definitions are generated for elements that have attributes or child elements.
- Elements with only text content are directly typed as `xs:string`.
- Elements with attributes and text content use `xs:simpleContent/xs:extension`.
- Elements with child elements use `xs:sequence` containing references (`ref`) to the child elements, marked with `minOccurs="0" maxOccurs="unbounded"`.
- Elements with mixed content (text and children) have `mixed="true"` added to their `xs:complexType`.
- Attributes are added using `xs:attribute` with `type="xs:string"` and `use="optional"`.

**Output:** The generated XSD string is displayed in the UI, and options to copy or download are enabled.

## Limitations

- **Best-Effort Only:** The generated XSD is an estimate based solely on the single XML instance provided. It might not accurately represent all constraints or variations allowed by the intended schema.
- **`xs:string` Only:** All inferred types are `xs:string`. The tool does not attempt to infer more specific types like numbers, dates, booleans, or enumerations.
- **No Constraints:** Length restrictions, patterns, or other facets are not inferred or included.
- **Occurrence Estimation:** The use of `minOccurs="0" maxOccurs="unbounded"` and `use="optional"` is a flexible default but may be overly permissive compared to the actual intended schema.
- **Namespace Handling:** Uses static placeholder namespaces (`tns`, `http://example.com/generatedSchema`). It does not parse, preserve, or intelligently handle namespaces defined in the source XML.
- **Order Sensitivity:** While it attempts to capture element order from the first instance, variations in order in subsequent similar elements within the sample XML are not accounted for.

---

This tool provides a useful starting point or a basic structural overview, but the generated XSD should always be reviewed and refined manually for production use.

**To Use This README:**

1. Save the content above as `README.md` in the root directory of your project.
2. **Optional:** Take a screenshot of your running application, save it (e.g., as `screenshot.png`) in your project, and uncomment/update the image link near the top of the README.
3. Replace `<your-repository-url>` and `<repository-directory-name>` with your actual repository details if applicable.
4. Commit the `README.md` file to your repository.