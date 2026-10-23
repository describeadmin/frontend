import type {
  NormalizedOutputOptions,
  OutputBundle,
  OutputChunk,
} from 'rolldown';
import type { PluginOption } from 'vite';

import { EOL } from 'node:os';

import { dateUtil, readPackageJSON } from '@describeadmin/node-utils';

/**
 * 用于注入版权信息
 * @returns
 */

async function viteLicensePlugin(
  root = process.cwd(),
): Promise<PluginOption | undefined> {
  const {
    description = '',
    homepage = '',
    version = '',
  } = await readPackageJSON(root);

  return {
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      handler: (_options: NormalizedOutputOptions, bundle: OutputBundle) => {
        const date = dateUtil().format('YYYY-MM-DD ');
        // 前端源自 Vben Admin（MIT），再分发必须保留其版权声明——这一行是义务，不要删
        const copyrightText = `/*!
  * describeadmin
  * Version: ${version}
  * License: MIT License
  * Based on Vben Admin, Copyright (c) 2024-present Vben (MIT License)
  * Description: ${description}
  * Date Created: ${date}
  * Homepage: ${homepage}
*/
              `.trim();

        for (const [, fileContent] of Object.entries(bundle)) {
          if (fileContent.type === 'chunk' && fileContent.isEntry) {
            const chunkContent = fileContent as OutputChunk;
            // 插入版权信息
            const content = chunkContent.code;
            const updatedContent = `${copyrightText}${EOL}${content}`;

            // 更新bundle
            (fileContent as OutputChunk).code = updatedContent;
          }
        }
      },
      order: 'post',
    },
    name: 'vite:license',
  };
}

export { viteLicensePlugin };
