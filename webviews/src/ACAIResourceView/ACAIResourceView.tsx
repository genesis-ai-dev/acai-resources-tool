import React, { useState, useEffect } from "react";
import "./ACAIResourceView.css";

declare global {
  interface Window {
    acquireVsCodeApi: () => any;
  }
}

const vscode = window.acquireVsCodeApi();

interface BookOption {
  name: string;
  id: string;
}

const ACAIResourceView: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState("");
  const [options, setOptions] = useState<BookOption[]>([]);
  const [textInput, setTextInput] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "setOptions":
          setOptions(message.options);
          break;
        case "searchResult":
          setSearchResult(message.result);
          setError(null);
          break;
        case "searchError":
          setError(message.error);
          setSearchResult(null);
          break;
      }
    };

    window.addEventListener("message", messageListener);

    return () => window.removeEventListener("message", messageListener);
  }, []);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOption(event.target.value);
  };

  const handleTextInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    if (/^[0-9:\s-]*$/.test(value)) {
      setTextInput(value);
    }
  };

  const handleSearch = () => {
    const selectedBook = options.find(
      (option) => option.name === selectedOption
    );
    if (selectedBook) {
      vscode.postMessage({
        command: "search",
        bookId: selectedBook.id,
        verseRef: textInput,
      });
    }
  };

  return (
    <div className="acai-resource-view">
      <h1>ACAI Resources</h1>
      <p>Welcome to the ACAI Resources tool!</p>
      <div className="select-container">
        <label htmlFor="option-select">Select a book:</label>
        <div className="input-container">
          <select
            id="option-select"
            value={selectedOption}
            onChange={handleSelectChange}
          >
            <option value="">Choose a book</option>
            {options.map((option, index) => (
              <option key={index} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="text-input"
            value={textInput}
            onChange={handleTextInputChange}
            placeholder="verse ref."
          />
          <button className="search-button" onClick={handleSearch}>
            Search
          </button>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}
      {searchResult && (
        <div className="search-result">
          <h2>Search Result</h2>
          <pre>{JSON.stringify(searchResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default ACAIResourceView;
