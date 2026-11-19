/* global beforeEach, jest */
// Icon refresh: tests run with the OS "reduce motion" setting ON by
// default so icon/spinner animations don't keep running after a test
// ends. __tests__/icons.test.tsx overrides this to exercise the motion.
const { AccessibilityInfo } = require('react-native');

beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});
