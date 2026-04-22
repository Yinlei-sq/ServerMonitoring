export interface LinuxCommandSpec {
  command: string;
  args: string[];
}

export interface LinuxOverviewCommands {
  host: {
    hostname: LinuxCommandSpec;
    platform: LinuxCommandSpec;
    arch: LinuxCommandSpec;
    uptime: LinuxCommandSpec;
  };
  cpu: {
    stat: LinuxCommandSpec;
    load: LinuxCommandSpec;
    cores: LinuxCommandSpec;
  };
  memory: LinuxCommandSpec;
  disks: LinuxCommandSpec;
  gpus: LinuxCommandSpec;
  processes: LinuxCommandSpec;
}

function commandSpec(command: string, ...args: string[]): LinuxCommandSpec {
  return { command, args };
}

export function buildLinuxOverviewCommands(): LinuxOverviewCommands {
  return {
    host: {
      hostname: commandSpec('hostname'),
      platform: commandSpec('uname', '-s'),
      arch: commandSpec('uname', '-m'),
      uptime: commandSpec('cat', '/proc/uptime')
    },
    cpu: {
      stat: commandSpec('cat', '/proc/stat'),
      load: commandSpec('cat', '/proc/loadavg'),
      cores: commandSpec('nproc')
    },
    memory: commandSpec('cat', '/proc/meminfo'),
    disks: commandSpec('df', '-kP'),
    gpus: commandSpec(
      'nvidia-smi',
      '--query-gpu=index,name,utilization.gpu,memory.used,memory.total',
      '--format=csv,noheader,nounits'
    ),
    processes: commandSpec('ps', '-eo', 'pid,user,%cpu,%mem,comm', '--no-headers')
  };
}
