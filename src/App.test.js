// src/App.test.js
import { render, screen } from '@testing-library/react';
import App from './App';
import '@testing-library/jest-dom'; // Ensure jest-dom matchers are available

test('renders the XmlToXsdConverter component', () => {
  render(<App />);
  // Check for an element reliably rendered by XmlToXsdConverter
  const titleElement = screen.getByText(/XML to XSD Converter/i);
  expect(titleElement).toBeInTheDocument();

  // Optionally, check for another key element to be more specific
  expect(screen.getByRole('button', { name: /Convert to XSD/i })).toBeInTheDocument();
});