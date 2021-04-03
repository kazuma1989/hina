# Hina - 雛

Simple project scaffolding from GitHub repositories without git command.
Inspired by [degit](https://github.com/Rich-Harris/degit).

## Usage

```console
npx hina user/repo
```

The command above will download files in https://github.com/user/repo.

Just downloads a tarball (https://github.com/user/repo/archive/HEAD.tar.gz) and then extract to the current directory.

### CLI

```console
npx hina user/repo               # copy into the current working directory
npx hina user/repo path/to/dir   # specify a directory

npx hina user/repo#dev           # branch
npx hina user/repo#v1.2.3        # release tag
npx hina user/repo#1234abcd      # commit hash

npx hina user/repo/sub           # extract a sub directory
```
