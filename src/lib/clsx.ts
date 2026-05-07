export default function clsx(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}
