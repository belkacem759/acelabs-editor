/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { IUserActivityService } from '../../../../../platform/void/common/userActivityService.js';
import { UserActivityService } from './userActivityService.common.js';

// Register only the main service - it handles storage internally now
registerSingleton(IUserActivityService, UserActivityService, InstantiationType.Eager);
