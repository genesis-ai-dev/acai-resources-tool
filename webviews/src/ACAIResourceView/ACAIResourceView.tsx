import React, { useState, useEffect } from "react";
import "./ACAIResourceView.css";
import { AcaiRecord } from "../../../types";
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeCheckbox,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeTextField,
} from "@vscode/webview-ui-toolkit";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";

// Ensure the VS Code design system is provided
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeCheckbox(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeTextField()
);

enum RecordTypes {
  PERSON = "PERSON",
  PLACE = "PLACE",
  DEITY = "DEITY",
}

enum SearchType {
  REFERENCE = "Reference",
  LABEL = "Label",
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
  searchType: SearchType;
  labelInput: string;
  topLevelLabelInput: string;
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
  searchType: SearchType.REFERENCE,
  labelInput: "",
  topLevelLabelInput: "",
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
  const [searchType, setSearchType] = useState<SearchType>(
    initialState.searchType
  );
  const [labelInput, setLabelInput] = useState(initialState.labelInput);
  const [topLevelLabelInput, setTopLevelLabelInput] = useState(
    initialState.topLevelLabelInput
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

  const handleSearchTypeChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    const newSearchType = target.value as SearchType;
    setSearchType(newSearchType);
    setLabelInput("");
    setTopLevelLabelInput("");
    vscode.postMessage({
      command: "updateState",
      state: { searchType: newSearchType },
    });
  };

  const handleLabelInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    setLabelInput(target.value);
  };

  const handleTopLevelLabelInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setTopLevelLabelInput(event.target.value);
  };

  const handleBookChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    setSelectedOption(target.value);
    sendStateUpdate({ selectedOption: target.value });
  };

  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "setBookData":
          setOptions(message.bookData);
          break;
        case "searchResult":
          setSearchResult(message.result);
          setError(null);
          setIsLoading(false);
          sendStateUpdate({ searchResult: message.result });
          break;
        case "searchError":
          setError(message.error);
          setSearchResult(null);
          setIsLoading(false);
          break;
        case "restoreState":
          if (message.selectedOption) {
            setSelectedOption(message.selectedOption);
          }
          if (message.textInput) {
            setTextInput(message.textInput);
          }
          if (message.searchResult) {
            setSearchResult(message.searchResult);
            setError(null);
          }
          if (message.selectedTypes) {
            setSelectedTypes(message.selectedTypes);
          }
          if (message.searchType) {
            setSearchType(message.searchType);
          }
          if (message.labelInput) {
            setLabelInput(message.labelInput);
          }
          if (message.topLevelLabelInput) {
            setTopLevelLabelInput(message.topLevelLabelInput);
          }
          break;
      }
    };

    window.addEventListener("message", messageListener);

    vscode.postMessage({ command: "requestInitialData" });

    return () => {
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
    if (searchType === SearchType.REFERENCE) {
      const selectedBook = options.find(
        (option) => option.id === selectedOption
      );
      if (!selectedBook) {
        setError("Please select a book for reference search.");
        return;
      }
      if (!textInput) {
        setError("Please enter a verse reference.");
        return;
      }
    } else if (searchType === SearchType.LABEL) {
      if (!topLevelLabelInput) {
        setError("Please enter a label for label search.");
        return;
      }
    }

    const searchData = {
      bookId: searchType === SearchType.REFERENCE ? selectedOption : "",
      verseRef: searchType === SearchType.REFERENCE ? textInput : "",
      types: selectedTypes,
      searchType: searchType,
      labelInput:
        searchType === SearchType.LABEL ? topLevelLabelInput : labelInput,
    };

    console.log("Initiating search:", searchData);
    setIsLoading(true);
    setSearchResult(null);
    setError(null);
    vscode.postMessage({
      command: "search",
      ...searchData,
    });
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

  const getInstructionText = () => {
    return searchType === SearchType.REFERENCE
      ? "Select a book and specify a verse reference:"
      : "Enter a label to search for:";
  };

  const renderTopLevelInputs = () => {
    if (searchType === SearchType.REFERENCE) {
      return (
        <>
          <select
            id="option-select"
            value={selectedOption}
            onChange={handleSelectChange}
            title="Select a book from the Bible"
          >
            <option value="">--</option>
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
            title="Leave empty to search entire book; Enter a verse reference (e.g. 1:1, 1:1-5, 1:1-2:3)"
          />
        </>
      );
    } else {
      return (
        <input
          type="text"
          className="text-input full-width"
          value={topLevelLabelInput}
          onChange={handleTopLevelLabelInputChange}
          placeholder="Enter label"
          title="Enter a label or partial lable (e.g. 'Judah', 'el', 'Lord')"
        />
      );
    }
  };

  const renderFilterBoxInputs = () => {
    if (searchType === SearchType.REFERENCE) {
      return (
        <>
          <h4 className="filter-subheader">Label Filter:</h4>
          <div className="filter-row">
            <VSCodeTextField
              placeholder="Enter label"
              value={labelInput}
              onChange={handleLabelInputChange as any}
            />
          </div>
        </>
      );
    } else {
      return (
        <>
          <h4 className="filter-subheader">Reference Filter:</h4>
          <div className="filter-row">
            <VSCodeDropdown
              value={selectedOption}
              onChange={handleBookChange as any}
            >
              <VSCodeOption value="">--</VSCodeOption>
              {options.map((option) => (
                <VSCodeOption key={option.id} value={option.id}>
                  {option.name}
                </VSCodeOption>
              ))}
            </VSCodeDropdown>
          </div>
          <div className="filter-row filter-row-gap">
            <VSCodeTextField
              placeholder="verse ref."
              value={textInput}
              onChange={(e: any) => setTextInput(e.target.value)}
            />
          </div>
        </>
      );
    }
  };

  return (
    <div className="acai-resource-view">
      <h1>ACAI Resources</h1>
      <div className="select-container">
        <label htmlFor="option-select">{getInstructionText()}</label>
        <div className="input-wrapper">
          <div className="input-container">
            <VSCodeButton
              appearance="icon"
              aria-label="Toggle filter options"
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              title="Click to show or hide additional filter options"
            >
              <i className="codicon codicon-filter"></i>
            </VSCodeButton>
            {renderTopLevelInputs()}
            <button
              className="search-button"
              onClick={handleSearch}
              disabled={isLoading}
              title="Click to search"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
          {isFilterExpanded && (
            <div className="filter-box">
              <h4 className="filter-subheader">Search By:</h4>
              <div className="search-input-container">
                <VSCodeDropdown
                  value={searchType}
                  onChange={handleSearchTypeChange as any}
                  title="Select the type of search to perform"
                >
                  {Object.values(SearchType).map((type) => (
                    <VSCodeOption key={type} value={type}>
                      {type}
                    </VSCodeOption>
                  ))}
                </VSCodeDropdown>
              </div>
              {renderFilterBoxInputs()}
              <h4 className="filter-subheader">Type Filter:</h4>
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
