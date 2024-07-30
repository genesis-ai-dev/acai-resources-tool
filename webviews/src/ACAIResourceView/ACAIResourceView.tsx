import React, { useState, useEffect } from "react";
import { gql } from '@apollo/client'
import "./ACAIResourceView.css";

declare global {
  interface Window {
    acquireVsCodeApi: () => any;
  }
}
// Ensure that the acquireVsCodeApi function is defined in the window object
const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const QUERY = gql`
query ACAIRecords {
  acaiRecords {
    label
    uri
  }
}
`
const ACAIResourceView: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState("");
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "setOptions":
          setOptions(message.options);
          break;
      }
    };

    window.addEventListener("message", messageListener);

    return () => window.removeEventListener("message", messageListener);
  }, []);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOption(event.target.value);
    vscode.postMessage({
      command: "optionSelected",
      value: event.target.value,
    });
  };

  return (
    <div>
      <select value={selectedOption} onChange={handleSelectChange}>
        <option value="">Select an option</option>
        {options.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
      <h1>ACAI Resources</h1>
      <p>Welcome to the ACAI Resources tool!</p>
      <p>Selected option: {selectedOption}</p>
    </div>
  );
};

export default ACAIResourceView;
