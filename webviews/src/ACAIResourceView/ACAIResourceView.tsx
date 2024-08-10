import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ACAIResourceView.css";
import { AcaiRecord, BookData } from "../../../types";
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeCheckbox,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeTextField,
  vsCodeLink,
} from "@vscode/webview-ui-toolkit";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
  VSCodeLink,
} from "@vscode/webview-ui-toolkit/react";

// Register VS Code design system components
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeCheckbox(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeTextField(),
  vsCodeLink()
);

// Enums and interfaces
enum RecordTypes {
  PERSON = "PERSON",
  PLACE = "PLACE",
  DEITY = "DEITY",
}

enum SearchType {
  REFERENCE = "Reference",
  LABEL = "Label",
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
  selectedTypes: [],
  searchType: SearchType.REFERENCE,
  labelInput: "",
  topLevelLabelInput: "",
};

// VS Code API
const vscode = window.acquireVsCodeApi();

const ACAIResourceView: React.FC = () => {
  // State hooks
  const [state, setState] = useState<ACAIResourceViewState>(initialState);
  const [options, setOptions] = useState<BookData[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const isResetting = useRef(false);

  // Memoize the updateState function
  const updateState = useCallback(
    (newState: Partial<ACAIResourceViewState>) => {
      setState((prevState) => ({ ...prevState, ...newState }));
      sendStateUpdate(newState);
    },
    []
  );

  // Send state update to VS Code extension
  const sendStateUpdate = (state: Partial<ACAIResourceViewState>) => {
    vscode.postMessage({ command: "updateState", state });
  };

  // Handle type filter changes
  const handleTypeChange = (type: RecordTypes) => {
    if (isResetting.current) return;

    updateState({
      selectedTypes: state.selectedTypes.includes(type)
        ? state.selectedTypes.filter((t) => t !== type)
        : [...state.selectedTypes, type],
    });
  };

  // Handle search type changes
  const handleSearchTypeChange = (event: Event) => {
    const newSearchType = (event.target as HTMLSelectElement)
      .value as SearchType;
    updateState({
      searchType: newSearchType,
      labelInput: "",
      topLevelLabelInput: "",
    });
  };

  // Effect for message listener
  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "setBookData":
          setOptions(message.bookData);
          break;
        case "searchResult":
          updateState({
            searchResult: message.result,
            error: null,
            isLoading: false,
          });
          break;
        case "searchError":
          updateState({
            error: message.error,
            searchResult: null,
            isLoading: false,
          });
          break;
        case "restoreState":
          updateState(message);
          break;
      }
    };

    window.addEventListener("message", messageListener);
    vscode.postMessage({ command: "requestInitialData" });

    return () => window.removeEventListener("message", messageListener);
  }, [updateState]); // Include updateState in the dependency array

  // Effect to request state restoration
  useEffect(() => {
    if (options.length > 0 && state.selectedOption === "") {
      vscode.postMessage({ command: "requestStateRestore" });
    }
  }, [options, state.selectedOption]);

  // Handle search
  const handleSearch = () => {
    if (!validateSearch()) return;

    const newSearchId = Date.now().toString();
    setSearchId(newSearchId);
    updateState({ isLoading: true, searchResult: null, error: null });

    vscode.postMessage({
      command: "search",
      bookId:
        state.searchType === SearchType.REFERENCE ? state.selectedOption : "",
      verseRef:
        state.searchType === SearchType.REFERENCE ? state.textInput : "",
      types: state.selectedTypes,
      searchType: state.searchType,
      labelInput:
        state.searchType === SearchType.LABEL
          ? state.topLevelLabelInput
          : state.labelInput,
      searchId: newSearchId,
    });
  };

  // Validate search inputs
  const validateSearch = () => {
    if (state.searchType === SearchType.REFERENCE) {
      if (!options.find((option) => option.id === state.selectedOption)) {
        updateState({ error: "Please select a book for reference search." });
        return false;
      }
    } else if (state.searchType === SearchType.LABEL) {
      if (!state.topLevelLabelInput) {
        updateState({ error: "Please enter a label for label search." });
        return false;
      }
    }
    return true;
  };

  // Cancel ongoing search
  const handleCancelSearch = () => {
    if (searchId) {
      vscode.postMessage({ command: "cancelSearch", searchId });
      setSearchId(null);
      updateState({ isLoading: false });
    }
  };

  // Toggle result expansion
  const handleResultClick = (id: string) => {
    updateState({ expandedResult: state.expandedResult === id ? null : id });
  };

  // Toggle group expansion
  const toggleGroup = (type: RecordTypes) => {
    updateState({
      expandedGroups: state.expandedGroups.includes(type)
        ? state.expandedGroups.filter((t) => t !== type)
        : [...state.expandedGroups, type],
    });
  };

  // Render description with HTML support
  const renderDescription = (description: string | undefined) => {
    if (!description) return <p>No description available.</p>;
    return description.includes("<p>") || description.includes("</p>") ? (
      <div dangerouslySetInnerHTML={{ __html: description }} />
    ) : (
      <p>{description}</p>
    );
  };

  // Group search results by type
  const groupResultsByType = (results: AcaiRecord[]) => {
    const grouped: { [key in RecordTypes]: AcaiRecord[] } = {
      [RecordTypes.PERSON]: [],
      [RecordTypes.PLACE]: [],
      [RecordTypes.DEITY]: [],
    };

    results.forEach((result) => {
      result.recordType.split(",").forEach((type) => {
        const trimmedType = type.trim().toUpperCase() as RecordTypes;
        if (trimmedType in RecordTypes) {
          grouped[trimmedType].push(result);
        }
      });
    });

    return grouped;
  };

  // Render result group
  const renderResultGroup = (type: RecordTypes, results: AcaiRecord[]) => {
    if (results.length === 0) return null;

    const isExpanded = state.expandedGroups.includes(type);

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
            {results.map((result) => (
              <li key={result.id} className="result-item">
                <div
                  className="result-label"
                  onClick={() => handleResultClick(result.id)}
                >
                  {result.label}
                </div>
                {state.expandedResult === result.id &&
                  renderResultDetails(result)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // Render result details
  const renderResultDetails = (result: AcaiRecord) => (
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
      {result.articles && result.articles.length > 0 && (
        <div className="result-articles">
          <h4>Related Articles</h4>
          {result.articles.map((article, index) => (
            <div key={index} className="article-item">
              <h5>{article.title}</h5>
              <p>{article.localized?.en || "No English content available"}</p>
            </div>
          ))}
        </div>
      )}
      {result.assets && result.assets.length > 0 && (
        <div className="result-assets">
          <h4>Related Assets</h4>
          {result.assets.map((asset, index) => (
            <div key={index} className="asset-item">
              <h5>{asset.title}</h5>
              <p>File: {asset.file}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Reset filters
  const handleResetFilters = () => {
    isResetting.current = true;
    updateState({
      selectedTypes: [],
      labelInput: "",
      textInput: "",
      selectedOption: "",
      topLevelLabelInput: "",
    });
    setTimeout(() => {
      isResetting.current = false;
    }, 0);
  };

  // Render functions for different parts of the UI
  const renderTopLevelInputs = () => {
    if (state.searchType === SearchType.REFERENCE) {
      return (
        <>
          <select
            id="option-select"
            value={state.selectedOption}
            onChange={(e) => updateState({ selectedOption: e.target.value })}
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
            value={state.textInput}
            onChange={(e) => {
              const value = e.target.value;
              if (/^[0-9:\s-]*$/.test(value)) {
                updateState({ textInput: value });
              }
            }}
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
          value={state.topLevelLabelInput}
          onChange={(e) => updateState({ topLevelLabelInput: e.target.value })}
          placeholder="Enter label"
          title="Enter a label or partial label (e.g. 'Judah', 'el', 'Lord')"
        />
      );
    }
  };

  const renderFilterBoxInputs = () => {
    if (state.searchType === SearchType.REFERENCE) {
      return (
        <>
          <h4 className="filter-subheader">Label Filter:</h4>
          <div className="filter-row">
            <VSCodeTextField
              placeholder="Enter label"
              value={state.labelInput}
              onChange={(e: any) => updateState({ labelInput: e.target.value })}
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
              value={state.selectedOption}
              onChange={(e: any) =>
                updateState({ selectedOption: e.target.value })
              }
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
              value={state.textInput}
              onChange={(e: any) => updateState({ textInput: e.target.value })}
            />
          </div>
        </>
      );
    }
  };

  return (
    <div className="acai-resource-view">
      <h1>ACAI Resources</h1>
      {/* Main search interface */}
      <div className="select-container">
        <label htmlFor="option-select">
          {state.searchType === SearchType.REFERENCE
            ? "Select a book and specify a verse reference:"
            : "Enter a label to search for:"}
        </label>
        <div className="input-wrapper">
          <div className="input-container">
            <VSCodeButton
              appearance="icon"
              aria-label="Toggle filter options"
              onClick={() =>
                updateState({ isFilterExpanded: !state.isFilterExpanded })
              }
              title="Click to show or hide additional filter options"
            >
              <i className="codicon codicon-filter"></i>
            </VSCodeButton>
            {renderTopLevelInputs()}
            <button
              className="search-button"
              onClick={state.isLoading ? handleCancelSearch : handleSearch}
              title={
                state.isLoading ? "Click to cancel search" : "Click to search"
              }
            >
              {state.isLoading ? "Cancel Search" : "Search"}
            </button>
          </div>
          {state.isFilterExpanded && (
            <div className="filter-box">
              <h4 className="filter-subheader">Search By:</h4>
              <div className="search-input-container">
                <VSCodeDropdown
                  value={state.searchType}
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
                    checked={state.selectedTypes.includes(type)}
                    onChange={() =>
                      !isResetting.current && handleTypeChange(type)
                    }
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </VSCodeCheckbox>
                ))}
              </div>
              <VSCodeLink className="reset-link" onClick={handleResetFilters}>
                reset
              </VSCodeLink>
            </div>
          )}
        </div>
      </div>
      {/* Loading spinner and error message */}
      {state.isLoading && <div className="loading-spinner"></div>}
      {state.error && <div className="error-message">{state.error}</div>}
      {/* Search results */}
      {state.searchResult && (
        <div className="search-result">
          <h2>Search Result</h2>
          {Object.entries(groupResultsByType(state.searchResult)).map(
            ([type, results]) => renderResultGroup(type as RecordTypes, results)
          )}
        </div>
      )}
    </div>
  );
};

export default ACAIResourceView;
