/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../instantiation/common/extensions.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { UpdateService } from './updateService.js';

export interface IUpdateService {
	readonly _serviceBrand: undefined;
	checkForUpdates(): Promise<void>;
	downloadUpdate(): Promise<void>;
	installUpdate(): Promise<void>;
	on(event: 'checking-for-update', listener: () => void): this;
	on(event: 'update-available', listener: (info: any) => void): this;
	on(event: 'update-not-available', listener: (info: any) => void): this;
	on(event: 'error', listener: (err: Error) => void): this;
	on(event: 'download-progress', listener: (progressObj: any) => void): this;
	on(event: 'update-downloaded', listener: (info: any) => void): this;
}

export const IUpdateService = createDecorator<IUpdateService>('updateService');

registerSingleton(IUpdateService, UpdateService, InstantiationType.Eager);
