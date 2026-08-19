import type {
  CustomPreferencesRecord,
  Preferences,
  PreferencesExtension,
} from '@describeadmin/core-preferences';
import type { DeepPartial } from '@describeadmin/core-typings';

/**
 * 如果你想所有的app都使用相同的默认偏好设置，你可以在这里定义
 * 而不是去修改 @describeadmin/core-preferences 中的默认偏好设置
 * @param preferences
 * @returns
 */

function defineOverridesPreferences(preferences: DeepPartial<Preferences>) {
  return preferences;
}

function definePreferencesExtension<
  TCustomPreferences extends object = CustomPreferencesRecord,
>(extension: PreferencesExtension<TCustomPreferences>) {
  return extension;
}

export { defineOverridesPreferences, definePreferencesExtension };

export * from '@describeadmin/core-preferences';
