import React, { useState, useEffect } from "react";
import "./ACAIResourceView.css";
import { AcaiRecord } from "../../../src/types/index";

declare global {
  interface Window {
    acquireVsCodeApi: () => any;
  }
}

const vscode = window.acquireVsCodeApi();

interface BookData {
  id: string;
  name: string;
}

const ACAIResourceView: React.FC = () => {
  console.log("Rendering ACAIResourceView component");
  const [selectedOption, setSelectedOption] = useState("");
  const [options, setOptions] = useState<BookData[]>([]);
  const [textInput, setTextInput] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  useEffect(() => {
    console.log("ACAIResourceView component mounted");

    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      console.log("Received message in ACAIResourceView:", message);
      switch (message.command) {
        case "setBookData":
          console.log("Received book data:", message.bookData);
          setOptions(message.bookData);
          break;
        case "searchResult":
          console.log("Received search result:", message.result);
          setSearchResult(message.result);
          setError(null);
          break;
        case "searchError":
          console.error("Search error:", message.error);
          setError(message.error);
          setSearchResult(null);
          break;
      }
    };

    window.addEventListener("message", messageListener);
    console.log("Message event listener added to window");

    // Send a message to the extension to request initial data
    vscode.postMessage({ command: "requestInitialData" });
    console.log("Sent requestInitialData message to extension");

    return () => {
      console.log("ACAIResourceView component unmounting");
      window.removeEventListener("message", messageListener);
    };
  }, []);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value;
    console.log("Book selection changed:", newValue);
    setSelectedOption(newValue);
  };

  const handleTextInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    if (/^[0-9:\s-]*$/.test(value)) {
      console.log("Verse reference input changed:", value);
      setTextInput(value);
    } else {
      console.warn("Invalid verse reference input:", value);
    }
  };

  const handleSearch = () => {
    const selectedBook = options.find((option) => option.id === selectedOption);
    if (selectedBook) {
      console.log("Initiating search:", {
        bookId: selectedBook.id,
        verseRef: textInput,
      });
      vscode.postMessage({
        command: "search",
        bookId: selectedBook.id,
        verseRef: textInput,
      });
    } else {
      console.warn("Search attempted without selecting a book");
    }
  };

  const handleResultClick = (id: string) => {
    setExpandedResult(expandedResult === id ? null : id);
  };

  console.log("Selected option:", selectedOption);

  return (
    <div className="acai-resource-view">
      <h1>ACAI Resources</h1>
      <div className="select-container">
        <label htmlFor="option-select">
          Select a verse reference or range:
        </label>
        <div className="input-container">
          <select
            id="option-select"
            value={selectedOption}
            onChange={handleSelectChange}
          >
            <option value="">Choose a book</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
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
          <ul className="result-list">
            {searchResult.map((result: AcaiRecord) => (
              <li key={result.id} className="result-item">
                <div
                  className="result-label"
                  onClick={() => handleResultClick(result.id)}
                >
                  {result.label}
                </div>
                {expandedResult === result.id && (
                  <div className="result-details">
                    <p>
                      <strong>Description:</strong> {result.description}
                    </p>
                    <p>
                      <strong>Record Type:</strong> {result.recordType}
                    </p>
                    <p>
                      <strong>URI:</strong> {result.uri}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

console.log("ACAIResourceView component defined");
export default ACAIResourceView;
