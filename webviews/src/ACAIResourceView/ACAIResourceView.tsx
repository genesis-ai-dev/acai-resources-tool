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
  verseRefInput: string;
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
  pinnedRecords: AcaiRecord[];
}

const initialState: ACAIResourceViewState = {
  selectedOption: "",
  verseRefInput: "",
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
  pinnedRecords: [],
};

// VS Code API
const vscode = window.acquireVsCodeApi();

const ACAIResourceView: React.FC = () => {
  // State hooks
  const [state, setState] = useState<ACAIResourceViewState>(initialState);
  const [options, setOptions] = useState<BookData[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const isResetting = useRef(false);
  const [expandedDetailRecord, setExpandedDetailRecord] =
    useState<AcaiRecord | null>(null);
  const [isAutoEnabled, setIsAutoEnabled] = useState(false);

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
        case "updatePinnedRecords":
          setState((prevState) => ({
            ...prevState,
            pinnedRecords: message.pinnedRecords,
          }));
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
        state.searchType === SearchType.REFERENCE ? state.verseRefInput : "",
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
            {results.map((result) => renderResultItem(result))}
          </ul>
        )}
      </div>
    );
  };

  // Render result details
  const renderResultDetails = (result: AcaiRecord) => (
    <div className="result-details">
      <h3
        className="result-details-label"
        onClick={() => handleHeaderClick(result)}
        style={{ cursor: "pointer" }}
      >
        {result.label}
      </h3>
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
      verseRefInput: "",
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
            value={state.verseRefInput}
            onChange={(e) => {
              const value = e.target.value;
              if (/^[0-9:\s-]*$/.test(value)) {
                updateState({ verseRefInput: value });
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
    return (
      <>
        <h4 className="filter-subheader">Search by:</h4>
        <div className="filter-row">
          <VSCodeDropdown
            value={state.searchType}
            onChange={handleSearchTypeChange as any}
          >
            <VSCodeOption value={SearchType.REFERENCE}>Reference</VSCodeOption>
            <VSCodeOption value={SearchType.LABEL}>Label</VSCodeOption>
          </VSCodeDropdown>
        </div>
        {state.searchType === SearchType.REFERENCE && (
          <div className="filter-row">
            <VSCodeCheckbox
              checked={isAutoEnabled}
              onChange={handleAutoChange as any}
            >
              Auto
            </VSCodeCheckbox>
          </div>
        )}
        {state.searchType === SearchType.REFERENCE && (
          <>
            <h4 className="filter-subheader">Label Filter:</h4>
            <div className="filter-row">
              <VSCodeTextField
                placeholder="Enter label"
                value={state.labelInput}
                onChange={(e: any) =>
                  updateState({ labelInput: e.target.value })
                }
              />
            </div>
          </>
        )}
        {state.searchType === SearchType.LABEL && (
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
                value={state.verseRefInput}
                onChange={(e: any) =>
                  updateState({ verseRefInput: e.target.value })
                }
              />
            </div>
          </>
        )}
        <h4 className="filter-subheader">Type Filter:</h4>
        <div className="checkbox-group">
          {Object.values(RecordTypes).map((type) => (
            <VSCodeCheckbox
              key={type}
              checked={state.selectedTypes.includes(type)}
              onChange={() => !isResetting.current && handleTypeChange(type)}
            >
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </VSCodeCheckbox>
          ))}
        </div>
        <VSCodeLink className="reset-link" onClick={handleResetFilters}>
          reset
        </VSCodeLink>
      </>
    );
  };

  const togglePinRecord = useCallback(
    (record: AcaiRecord, isPinnedVersion: boolean) => {
      setState((prevState) => {
        const isPinned = prevState.pinnedRecords.some(
          (r) => r.id === record.id
        );
        let newPinnedRecords: AcaiRecord[];

        if (isPinned) {
          // Always remove the record if it's already pinned, regardless of where it's clicked
          newPinnedRecords = prevState.pinnedRecords.filter(
            (r) => r.id !== record.id
          );
        } else if (!isPinnedVersion) {
          // Only add the record if it's not already pinned and not clicked in the pinned version
          newPinnedRecords = [...prevState.pinnedRecords, record];
        } else {
          // No change needed if trying to pin an already pinned record in the pinned version
          return prevState;
        }

        // Update the state in the extension
        vscode.postMessage({
          command: "updatePinnedRecords",
          pinnedRecords: newPinnedRecords,
        });

        return { ...prevState, pinnedRecords: newPinnedRecords };
      });
    },
    []
  );

  const [isPinnedExpanded, setIsPinnedExpanded] = useState(true);
  const [expandedPinnedRecords, setExpandedPinnedRecords] = useState<
    Set<string>
  >(new Set());

  const togglePinnedGroup = () => {
    setIsPinnedExpanded(!isPinnedExpanded);
  };

  const togglePinnedRecord = (id: string) => {
    setExpandedPinnedRecords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const collapseAllPinnedRecords = () => {
    setExpandedPinnedRecords(new Set());
  };

  const renderPinnedGroup = () => {
    return (
      <div className="pinned-section">
        <div className="result-group-header">
          <h3
            className={`result-group-title ${
              isPinnedExpanded ? "expanded" : ""
            }`}
            onClick={togglePinnedGroup}
          >
            Pinned Records ({state.pinnedRecords.length})
          </h3>
          {isPinnedExpanded && state.pinnedRecords.length > 0 && (
            <VSCodeLink
              className="collapse-all"
              onClick={collapseAllPinnedRecords}
            >
              collapse all
            </VSCodeLink>
          )}
        </div>
        {isPinnedExpanded && state.pinnedRecords.length > 0 && (
          <ul className="result-list">
            {state.pinnedRecords.map((result) => (
              <li key={result.id} className="result-item pinned">
                <div
                  className="result-label"
                  onClick={() => togglePinnedRecord(result.id)}
                >
                  {result.label}
                  <span
                    className="codicon codicon-pinned"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinRecord(result, true);
                    }}
                    title="Unpin"
                  ></span>
                </div>
                {expandedPinnedRecords.has(result.id) &&
                  renderResultDetails(result)}
              </li>
            ))}
          </ul>
        )}
        {isPinnedExpanded && state.pinnedRecords.length === 0 && (
          <p>No pinned records yet.</p>
        )}
      </div>
    );
  };

  const renderResultItem = (
    result: AcaiRecord,
    isPinnedVersion: boolean = false
  ) => {
    const isPinned = state.pinnedRecords.some((r) => r.id === result.id);
    console.log(result.label + " is pinned: " + isPinned);

    return (
      <li key={result.id} className={`result-item ${isPinned ? "pinned" : ""}`}>
        <div
          className="result-label"
          onClick={() => handleResultClick(result.id)}
        >
          {result.label}
          <span
            className={`codicon ${isPinned ? "codicon-pinned" : "codicon-pin"}`}
            onClick={(e) => {
              e.stopPropagation();
              togglePinRecord(result, isPinnedVersion);
            }}
            title={isPinned ? "Unpin" : "Pin"}
          ></span>
        </div>
        {state.expandedResult === result.id && renderResultDetails(result)}
      </li>
    );
  };

  const handleHeaderClick = (record: AcaiRecord) => {
    setExpandedDetailRecord(record);
  };

  const renderExpandedDetailView = () => {
    if (!expandedDetailRecord) return null;

    return (
      <div className="expanded-detail-view">
        <div className="expanded-detail-header">
          <VSCodeButton
            appearance="icon"
            onClick={() => setExpandedDetailRecord(null)}
          >
            <i className="codicon codicon-arrow-left"></i>
          </VSCodeButton>
          <h2>{expandedDetailRecord.label}</h2>
        </div>
        <div className="expanded-detail-content">
          {renderResultDetails(expandedDetailRecord)}
          <p>More info coming soon!</p>
        </div>
      </div>
    );
  };

  const handleAutoChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    setIsAutoEnabled(target.checked);
    if (target.checked) {
      vscode.postMessage({ command: "turnOnRefListener" });
    } else {
      vscode.postMessage({ command: "turnOffRefListener" });
    }
  };

  return (
    <div className="acai-resource-view">
      {expandedDetailRecord ? (
        renderExpandedDetailView()
      ) : (
        <>
          <h1>ACAI Resources</h1>
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
                    state.isLoading
                      ? "Click to cancel search"
                      : "Click to search"
                  }
                >
                  {state.isLoading ? "Cancel Search" : "Search"}
                </button>
              </div>
              {state.isFilterExpanded && (
                <div className="filter-box">{renderFilterBoxInputs()}</div>
              )}
            </div>
          </div>
          {state.isLoading && <div className="loading-spinner"></div>}
          {state.error && <div className="error-message">{state.error}</div>}

          {renderPinnedGroup()}

          {state.searchResult && state.searchResult.length > 0 && (
            <div className="search-result">
              <h2 className="section-header">Search Result</h2>
              {Object.entries(groupResultsByType(state.searchResult)).map(
                ([type, results]) =>
                  renderResultGroup(
                    type as RecordTypes,
                    results as AcaiRecord[]
                  )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ACAIResourceView;
