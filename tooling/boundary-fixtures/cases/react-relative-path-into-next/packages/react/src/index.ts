// A raw relative path reaching into a sibling package's source tree bypasses package.json
// `exports` entirely (exports only governs bare-specifier resolution), which is exactly the
// gap check:boundaries has to close.
import '../../next/src/index';
