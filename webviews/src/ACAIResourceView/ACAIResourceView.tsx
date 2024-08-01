import React, { useState, useEffect } from "react";
import "./ACAIResourceView.css";
import { AcaiRecord } from "../../../types";
import { VSCodeButton, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";

enum RecordTypes {
  PERSON = "PERSON",
  PLACE = "PLACE",
  DEITY = "DEITY",
}

interface BookData {
  id: string;
  name: string;
}

interface ACAIResourceViewState {
  selectedOption: string;
  textInput: string;
  searchResult: AcaiRecord[] | null;
  error: string | null;
  isLoading: boolean;
  expandedResult: string | null;
  expandedGroups: RecordTypes[];
  isFilterExpanded: boolean;
  selectedTypes: RecordTypes[];
}

const initialState: ACAIResourceViewState = {
  selectedOption: "",
  textInput: "",
  searchResult: null,
  error: null,
  isLoading: false,
  expandedResult: null,
  expandedGroups: Object.values(RecordTypes),
  isFilterExpanded: false,
  selectedTypes: Object.values(RecordTypes),
};

declare global {
  interface Window {
    acquireVsCodeApi: () => any;
  }
}

const vscode = window.acquireVsCodeApi();

const ACAIResourceView: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState(
    initialState.selectedOption
  );
  const [textInput, setTextInput] = useState(initialState.textInput);
  const [searchResult, setSearchResult] = useState(initialState.searchResult);
  const [error, setError] = useState(initialState.error);
  const [isLoading, setIsLoading] = useState(initialState.isLoading);
  const [expandedResult, setExpandedResult] = useState(
    initialState.expandedResult
  );
  const [expandedGroups, setExpandedGroups] = useState(
    initialState.expandedGroups
  );
  const [options, setOptions] = useState<BookData[]>([]);
  const [isFilterExpanded, setIsFilterExpanded] = useState(
    initialState.isFilterExpanded
  );
  const [selectedTypes, setSelectedTypes] = useState<RecordTypes[]>(
    initialState.selectedTypes
  );

  const sendStateUpdate = (state: Partial<ACAIResourceViewState>) => {
    vscode.postMessage({
      command: "updateState",
      state: state,
    });
  };

  const handleTypeChange = (type: RecordTypes) => {
    const newSelectedTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];

    setSelectedTypes(newSelectedTypes);

    sendStateUpdate({ selectedTypes: newSelectedTypes });
  };

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
          setIsLoading(false);
          sendStateUpdate({ searchResult: message.result });
          break;
        case "searchError":
          console.error("Search error:", message.error);
          setError(message.error);
          setSearchResult(null);
          setIsLoading(false);
          break;
        case "restoreState":
          console.log("Restoring state:", message);
          if (message.selectedOption) {
            console.log("Setting selected option:", message.selectedOption);
            setSelectedOption(message.selectedOption);
          }
          if (message.textInput) {
            console.log("Setting text input:", message.textInput);
            setTextInput(message.textInput);
          }
          if (message.searchResult) {
            console.log("Setting search results:", message.searchResult);
            setSearchResult(message.searchResult);
            setError(null);
          }
          if (message.selectedTypes) {
            console.log("Setting selected types:", message.selectedTypes);
            setSelectedTypes(message.selectedTypes);
          }
          break;
      }
    };

    window.addEventListener("message", messageListener);
    console.log("Message event listener added to window");

    vscode.postMessage({ command: "requestInitialData" });
    console.log("Sent requestInitialData message to extension");

    return () => {
      console.log("ACAIResourceView component unmounting");
      window.removeEventListener("message", messageListener);
    };
  }, []);

  useEffect(() => {
    if (options.length > 0 && selectedOption === "") {
      vscode.postMessage({ command: "requestStateRestore" });
    }
  }, [options, selectedOption]);

  useEffect(() => {
    console.log("Current state:", { selectedOption, textInput, searchResult });
    if (selectedOption && textInput && searchResult) {
      console.log("State restored:", {
        selectedOption,
        textInput,
        searchResult,
      });
      // You can add any additional logic here that needs to run when the state is restored
    }
  }, [selectedOption, textInput, searchResult]);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value;
    console.log("Book selection changed:", newValue);
    setSelectedOption(newValue);
    sendStateUpdate({ selectedOption: newValue });
  };

  const handleTextInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    if (/^[0-9:\s-]*$/.test(value)) {
      console.log("Verse reference input changed:", value);
      setTextInput(value);
      sendStateUpdate({ textInput: value });
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
        types: selectedTypes,
      });
      setIsLoading(true);
      setSearchResult(null);
      setError(null);
      vscode.postMessage({
        command: "search",
        bookId: selectedBook.id,
        verseRef: textInput,
        types: selectedTypes,
      });
    } else {
      console.warn("Search attempted without selecting a book");
    }
  };

  const handleResultClick = (id: string) => {
    setExpandedResult(expandedResult === id ? null : id);
  };

  const toggleGroup = (type: RecordTypes) => {
    setExpandedGroups((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const renderDescription = (description: string) => {
    const paragraphs = description.split("</p>").filter((p) => p.trim() !== "");
    return paragraphs.map((paragraph, index) => (
      <p key={index} dangerouslySetInnerHTML={{ __html: paragraph + "</p>" }} />
    ));
  };

  const groupResultsByType = (results: AcaiRecord[]) => {
    const grouped: { [key in RecordTypes]: AcaiRecord[] } = {
      [RecordTypes.PERSON]: [],
      [RecordTypes.PLACE]: [],
      [RecordTypes.DEITY]: [],
    };

    results.forEach((result) => {
      const types = result.recordType
        .split(",")
        .map((type) => type.trim().toUpperCase());
      types.forEach((type) => {
        if (type in RecordTypes) {
          grouped[type as RecordTypes].push(result);
        }
      });
    });

    return grouped;
  };

  const renderResultGroup = (type: RecordTypes, results: AcaiRecord[]) => {
    if (results.length === 0) return null;

    const isExpanded = expandedGroups.includes(type);

    return (
      <div key={type} className="result-group">
        <h3
          className={`result-group-title ${isExpanded ? "expanded" : ""}`}
          onClick={() => toggleGroup(type)}
        >
          {type} ({results.length})
        </h3>
        {isExpanded && (
          <ul className="result-list">
            {results.map((result: AcaiRecord) => (
              <li key={result.id} className="result-item">
                <div
                  className="result-label"
                  onClick={() => handleResultClick(result.id)}
                >
                  {result.label}
                </div>
                {expandedResult === result.id && (
                  <div className="result-details">
                    <h3 className="result-details-label">{result.label}</h3>
                    <div className="result-description">
                      {renderDescription(result.description)}
                    </div>
                    <div className="result-info">
                      <p>
                        <strong>Record Type:</strong> {result.recordType}
                      </p>
                      <p>
                        <strong>URI:</strong> {result.uri}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="acai-resource-view">
      <h1>ACAI Resources</h1>
      <div className="select-container">
        <label htmlFor="option-select">
          Select a book and specify a verse reference:
        </label>
        <div className="input-wrapper">
          <div className="input-container">
            <VSCodeButton
              appearance="icon"
              aria-label="Filter"
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            >
              <i className="codicon codicon-filter"></i>
            </VSCodeButton>
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
            <button
              className="search-button"
              onClick={handleSearch}
              disabled={isLoading}
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
          {isFilterExpanded && (
            <div className="filter-box">
              <h3 className="filter-header">Filter</h3>
              <h4 className="filter-subheader">By Type:</h4>
              <div className="checkbox-group">
                {Object.values(RecordTypes).map((type) => (
                  <VSCodeCheckbox
                    key={type}
                    checked={selectedTypes.includes(type)}
                    onChange={() => handleTypeChange(type)}
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </VSCodeCheckbox>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {isLoading && <div className="loading-spinner"></div>}
      {error && <div className="error-message">{error}</div>}
      {searchResult && (
        <div className="search-result">
          <h2>Search Result</h2>
          {Object.entries(groupResultsByType(searchResult)).map(
            ([type, results]) => renderResultGroup(type as RecordTypes, results)
          )}
        </div>
      )}
    </div>
  );
};

export default ACAIResourceView;
