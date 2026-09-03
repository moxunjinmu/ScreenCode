import packageMetadata from '../../package.json';

/** 构建时从唯一版本源 package.json 注入，避免安装包和界面版本漂移。 */
export const APP_VERSION = packageMetadata.version;

/** 生成品牌区域的完整可访问名称。 */
export function formatAppLabel(): string {
  return `ScreenCode ${APP_VERSION}`;
}
