import * as moment from 'moment';
import { AnyAction } from 'redux';

import {
  ResourcePageActions,
  ResourcesActions,
  UserInfoActions,
} from './actions/action-names';
import {
  IResourcePageState,
  FileOrFolderTypes,
  IFile,
  IFolder,
  IMainPageState,
  IResourcesState,
  IUserInfo,
  ResourcesActionTypes,
  UserActionTypes,
} from './types';

const initResourceListPageState: IMainPageState = {
  allResourcesSelected: false,
  searchTerm: '',
};

const initResourcePageState: IResourcePageState = {
  allJupyterSelected: false,
  allHydroShareSelected: false,
  selectedLocalFilesAndFolders: new Set(),
  selectedHydroShareFilesAndFolders: new Set(),
  searchTerm: '',
};

const initResourcesState: IResourcesState = {
  searchTerm: '',
  allResources: {},
};

export function resourcePageReducer(state: IResourcePageState = initResourcePageState, action: AnyAction): IResourcePageState {
  let doMakeSelected;
  switch (action.type) {
    case ResourcePageActions.TOGGLE_IS_SELECTED_ALL_JUPYTER:
      doMakeSelected = !state.allJupyterSelected;
      return {
        ...state,
        allJupyterSelected: doMakeSelected,
        selectedLocalFilesAndFolders: toggleAllFilesOrFoldersSelected(action.payload.jupyterHubFiles, doMakeSelected),
      };
    case ResourcePageActions.TOGGLE_IS_SELECTED_ALL_HYDROSHARE:
      doMakeSelected = !state.allHydroShareSelected;
      const {
        hydroShareResource,
      } = action.payload;
      if (!hydroShareResource) { // Should never be the case
        return state;
      }
      return {
        ...state,
        allHydroShareSelected: doMakeSelected,
        selectedHydroShareFilesAndFolders: toggleAllFilesOrFoldersSelected(hydroShareResource.files, doMakeSelected),
      };
    case ResourcePageActions.TOGGLE_IS_SELECTED_ONE_JUPYTER:
      return {
        ...state,
        allJupyterSelected: false,
        selectedLocalFilesAndFolders: toggleFileOrFolderSelected(action.payload, state.selectedLocalFilesAndFolders),
      };
    case ResourcePageActions.TOGGLE_IS_SELECTED_ONE_HYDROSHARE:
      return {
        ...state,
        allHydroShareSelected: false,
        selectedHydroShareFilesAndFolders: toggleFileOrFolderSelected(action.payload, state.selectedHydroShareFilesAndFolders),
      };
    case ResourcePageActions.SEARCH_RESOURCE_BY:
        return {...state, searchTerm: action.payload};
    case ResourcePageActions.SORT_BY_NAME:
      return {...state, sortBy: action.payload};
    default:
      return state;
  }
}

function toggleAllFilesOrFoldersSelected(rootDir: IFolder, doMakeSelected: boolean): Set<string> {
  if (!doMakeSelected) {
    return new Set();
  }
  let selectedFilesAndFolders: Set<string> = new Set();
  rootDir.contents.forEach((resourceFileOrFolders: IFile | IFolder) => {
    selectedFilesAndFolders = recursivelySetSelectedState(selectedFilesAndFolders, resourceFileOrFolders, doMakeSelected);
  });
  return selectedFilesAndFolders;
}

function toggleFileOrFolderSelected(toggledItem: IFile | IFolder, selectedFilesAndFolders: Set<string>): Set<string> {
  selectedFilesAndFolders = new Set(selectedFilesAndFolders);
  const itemWasSelected = selectedFilesAndFolders.has(toggledItem.dirPath + toggledItem.name);
  return recursivelySetSelectedState(selectedFilesAndFolders, toggledItem, !itemWasSelected);
}

export function mainPageReducer(state: IMainPageState = initResourceListPageState, action: AnyAction): IMainPageState {
  switch (action.type) {
    case ResourcePageActions.TOGGLE_IS_SELECTED_ALL_JUPYTER:
      return {...state, allResourcesSelected: !state.allResourcesSelected};
    case ResourcePageActions.SEARCH_BY:
      return {...state, searchTerm: action.payload};
    case ResourcePageActions.SORT_BY_NAME:
      return {...state, sortBy: action.payload};
    case ResourcesActions.NEW_RESOURCE:
        return state;
    default:
      return state;
  }
}


export function resourcesReducer(state: IResourcesState = initResourcesState, action: ResourcesActionTypes): IResourcesState {
  switch (action.type) {
    case ResourcesActions.SET_RESOURCES:
      const allResources = {};
      action.payload.forEach(jupyterHubResource => {
        if (jupyterHubResource.hydroShareResource) {
          jupyterHubResource.hydroShareResource.date_last_updated = moment(jupyterHubResource.hydroShareResource.date_last_updated);
        }
        allResources[jupyterHubResource.hydroShareResource.resource_id] = jupyterHubResource;
      });
      return {...state, allResources };
    case ResourcesActions.SET_RESOURCE_LOCAL_FILES:
      const {
        resourceId,
        files,
      } = action.payload;
      let sizeBytes = 0;
      files?.forEach(f => { sizeBytes += f.sizeBytes });
      const jupyterHubRootDir: IFolder = {
        contents: recursivelyConvertDatesToMoment(files),
        dirPath: '/',
        name: '',
        sizeBytes,
        type: FileOrFolderTypes.FOLDER,
      };
      return {
        ...state,
        allResources: {
          ...state.allResources,
          [resourceId]: {
            ...state.allResources[resourceId],
            jupyterHubFiles: jupyterHubRootDir,
          },
        },
      };
    case ResourcesActions.SET_RESOURCE_HYDROSHARE_FILES:
      const {
        resourceId: resId,
        files: f,
      } = action.payload;

      let hsRootSizeBytes = 0;
      f?.forEach(f => { hsRootSizeBytes += f.sizeBytes });
      const hydroShareRootDir: IFolder = {
        contents: recursivelyConvertDatesToMoment(f),
        dirPath: '/',
        name: '',
        sizeBytes: hsRootSizeBytes,
        type: FileOrFolderTypes.FOLDER,
      };
      return {
        ...state,
        allResources: {
          ...state.allResources,
          [resId]: {
            ...state.allResources[resId],
            hydroShareResource: {
              ...state.allResources[resId].hydroShareResource,
              files: hydroShareRootDir,
            },
          },
        },
      };
    default:
      return state;
  }
}

function recursivelyConvertDatesToMoment(files: (IFile | IFolder)[]) {
  return files.map(fileOrFolder => {
    fileOrFolder.lastModified = moment(fileOrFolder.lastModified);
    return fileOrFolder;
  });
}

export function userDataReducer(state: IUserInfo, action: UserActionTypes): IUserInfo | null {
  switch (action.type) {
    case UserInfoActions.SET_USER_INFO:
      return {...state, ...action.payload};
    default:
      if (state === undefined) {
        return null;
      }
      return state;
  }
}

function recursivelySetSelectedState(selections: Set<string>, item: IFile | IFolder, makeSelected: boolean): Set<string> {
  const itemPath = item.dirPath + item.name;
  if (makeSelected) {
    selections.add(itemPath);
  } else {
    selections.delete(itemPath);
  }

  if (item.type === FileOrFolderTypes.FOLDER) {
    const folder = item as IFolder;
    folder.contents.forEach(childItem => {
      selections = recursivelySetSelectedState(selections, childItem, makeSelected);
    });
  }
  return selections;
}
