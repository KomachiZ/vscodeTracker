export const COMMADN_TYPE = [
  {
    label: '✨ th init',
    detail: 'Initialize a project',
    description: '（初始化工程）'
  },
  {
    label: '🚝 th dev',
    detail: 'Adding project resources',
    description: '（启动开发服务）'
  },
  {
    label: '🧪 th test',
    detail: 'Perform static code checking and testing',
    description: '（执行检查和测试）'
  },
  {
    label: '👷 th build',
    detail: 'Build current project',
    description: '（构建工程）'
  },
  {
    label: '📙 th publish',
    detail: 'Publish current project to target environment',
    description: '（发布工程）'
  },
  {
    label: '⏰ th update',
    detail: 'Update remote configs and dependent modules',
    description: '（重装依赖）'
  },
  {
    label: '🙏 th -h',
    detail: 'Display cli help information',
    description: '（帮助）'
  },
];


export const COMMANDS: any = {
  'MyTheme.th.init': 'th init',
  'MyTheme.th.dev': 'th dev',
  'MyTheme.th.test': 'th test',
  'MyTheme.th.build': 'th build',
  'MyTheme.th.publish': 'th publish',
  'MyTheme.th.update': 'th update',
  'MyTheme.th.help': 'th --help'
};