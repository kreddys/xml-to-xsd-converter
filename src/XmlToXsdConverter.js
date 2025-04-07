import React, { useState, useRef, useCallback } from 'react';
import { generateXsd } from './xsdGenerator'; // Import the logic
import './XmlToXsdConverter.css'; // Import the styles

function XmlToXsdConverter() {
    const [xmlInput, setXmlInput] = useState('');
    const [xsdOutput, setXsdOutput] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copyStatus, setCopyStatus] = useState('');
    const fileInputRef = useRef(null); // Ref for the hidden file input

    const handleXmlInputChange = (event) => {
        setXmlInput(event.target.value);
        setError(''); // Clear error when user types
        setXsdOutput(''); // Clear output when input changes
        setCopyStatus('');
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setXmlInput(e.target.result);
                setError('');
                setXsdOutput('');
                setCopyStatus('');
            };
            reader.onerror = () => {
                setError('Error reading file.');
                setXmlInput('');
            };
            reader.readAsText(file);
        }
        // Reset file input value so the same file can be re-uploaded
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const triggerFileChoose = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click(); // Programmatically click the hidden file input
        }
    };

    const handleConvert = useCallback(() => {
        if (!xmlInput.trim()) {
            setError('Please paste or upload XML content.');
            return;
        }
        setIsLoading(true);
        setError('');
        setXsdOutput('');
        setCopyStatus('');

        // Use setTimeout to allow UI to update before potentially blocking conversion
        setTimeout(() => {
            try {
                const generatedSchema = generateXsd(xmlInput);
                setXsdOutput(generatedSchema);
            } catch (err) {
                console.error("Conversion Error:", err);
                setError(`Conversion failed: ${err.message}`);
                setXsdOutput('');
            } finally {
                setIsLoading(false);
            }
        }, 50); // Small delay (50ms)
    }, [xmlInput]); // Dependency: re-create function only if xmlInput changes

    const handleCopyToClipboard = async () => {
        if (!xsdOutput) return;
        try {
            await navigator.clipboard.writeText(xsdOutput);
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus(''), 2000); // Clear status after 2 seconds
        } catch (err) {
            console.error('Failed to copy:', err);
            setCopyStatus('Copy failed!');
            setTimeout(() => setCopyStatus(''), 2000);
        }
    };

    const handleDownload = () => {
        if (!xsdOutput) return;
        try {
            const blob = new Blob([xsdOutput], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'generated_schema.xsd'; // Default filename
            document.body.appendChild(a); // Append anchor to body
            a.click(); // Programmatically click the anchor to trigger download
            document.body.removeChild(a); // Remove anchor from body
            URL.revokeObjectURL(url); // Free up memory
        } catch (err) {
            console.error('Failed to download:', err);
            setError('Download failed. Please try copying the text.');
        }
    };

    return (
        <div className="converter-container">
            <h1 className="converter-title">XML to XSD Converter (Best Effort)</h1>

            {/* --- Input Section --- */}
            <div className="input-section">
                <label htmlFor="xml-input">Paste XML Content or Upload File:</label>
                <textarea
                    id="xml-input"
                    value={xmlInput}
                    onChange={handleXmlInputChange}
                    placeholder="<root><element attribute='value'>Data</element>...</root>"
                    spellCheck="false"
                />
                <div className="button-group">
                    {/* Hidden file input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xml, application/xml" // Accept XML files
                        style={{ display: 'none' }} // Keep it hidden
                    />
                    {/* Visible button to trigger file input */}
                    <button type="button" onClick={triggerFileChoose} className="file-input-label">
                        Upload XML File
                    </button>
                    <button
                        onClick={handleConvert}
                        disabled={isLoading || !xmlInput.trim()}
                        className="button"
                    >
                        {isLoading ? 'Converting...' : 'Convert to XSD'}
                    </button>
                </div>
            </div>

            {/* --- Status Messages --- */}
            {isLoading && <div className="status-message loading">Processing XML...</div>}
            {error && <div className="status-message error">{error}</div>}

            {/* --- Output Section --- */}
            {xsdOutput && !isLoading && (
                <div className="output-section">
                    <label htmlFor="xsd-output">Generated XSD Schema:</label>
                    <textarea
                        id="xsd-output"
                        value={xsdOutput}
                        readOnly
                        className="output-area"
                    />
                    <div className="button-group">
                        <button onClick={handleCopyToClipboard} className="button button-secondary">
                            Copy XSD
                        </button>
                        {copyStatus && <span className="action-feedback">{copyStatus}</span>}
                        <button onClick={handleDownload} className="button button-secondary">
                            Download .xsd File
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default XmlToXsdConverter;