import React, { useState, useEffect } from "react";
import "./ACAIResourceView.css";

declare global {
  interface Window {
    acquireVsCodeApi: () => any;
  }
}

const vscode = window.acquireVsCodeApi();

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
    <div className="acai-resource-view">
      <h1>ACAI Resources</h1>
      <p>Welcome to the ACAI Resources tool!</p>
      <div className="select-container">
        <label htmlFor="option-select">Select a book:</label>
        <select
          id="option-select"
          value={selectedOption}
          onChange={handleSelectChange}
        >
          <option value="">Choose an option</option>
          {options.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      {selectedOption && (
        <div className="selected-option">
          <h2>Selected Option</h2>
          <p>{selectedOption}</p>
        </div>
      )}
    </div>
  );
};

export default ACAIResourceView;
