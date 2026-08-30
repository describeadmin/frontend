interface AuthenticationProps {
  /**
   * @zh_CN 验证码登录路径
   */
  codeLoginPath?: string;
  /**
   * @zh_CN 忘记密码路径
   */
  forgetPasswordPath?: string;

  /**
   * @zh_CN 是否处于加载处理状态
   */
  loading?: boolean;

  /**
   * @zh_CN 邮箱验证码登录路径
   */
  emailLoginPath?: string;

  /**
   * @zh_CN 后端启用的登录方式列表，取值来自 `GET /api/auth/providers`
   *
   * 传入后由它驱动第二种登录方式入口的显隐——目前只认 `email` 这一项
   * （框架内也只有邮箱插件是真实存在的第二种能力）：列表里含 `email`
   * 就渲染邮箱登录入口，不含就不渲染。业务方 `login.vue` 只需把接口结果
   * 原样透传进来，不用自己判断；引入新的登录插件后前端也不必改
   * （develop_plan.md 3.2）。
   *
   * 与 `showEmailLogin` 的关系：显式传 `showEmailLogin` 优先级更高（用于强制
   * 打开/关闭）；只传 `providers` 时按上面的规则自动推导。
   */
  providers?: string[];

  /**
   * @zh_CN 二维码登录路径
   */
  qrCodeLoginPath?: string;

  /**
   * @zh_CN 注册路径
   */
  registerPath?: string;

  /**
   * @zh_CN 是否显示验证码登录
   */
  showCodeLogin?: boolean;
  /**
   * @zh_CN 是否显示忘记密码
   */
  showForgetPassword?: boolean;

  /**
   * @zh_CN 是否显示邮箱验证码登录
   *
   * 默认关闭：与其余几个 show* 开关默认打开不同——核心不内置任何验证码类登录方式，
   * 是否显示这个入口应该由业务方按自己是否引入了对应插件显式决定，
   * 而不是像 showCodeLogin 那样"先开着，能力没做完也留个死壳"。
   */
  showEmailLogin?: boolean;

  /**
   * @zh_CN 是否显示二维码登录
   */
  showQrcodeLogin?: boolean;

  /**
   * @zh_CN 是否显示注册按钮
   */
  showRegister?: boolean;

  /**
   * @zh_CN 是否显示记住账号
   */
  showRememberMe?: boolean;

  /**
   * @zh_CN 是否显示第三方登录
   */
  showThirdPartyLogin?: boolean;

  /**
   * @zh_CN 登录框子标题
   */
  subTitle?: string;

  /**
   * @zh_CN 登录框标题
   */
  title?: string;
  /**
   * @zh_CN 提交按钮文本
   */
  submitButtonText?: string;
}

export type { AuthenticationProps };
