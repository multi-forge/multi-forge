import unittest
import sys
import time

def run_all():
    print("======================================================================")
    print(" ForgeHub E2E Automated Test Suite")
    print("======================================================================\n")
    
    loader = unittest.TestLoader()
    suite = loader.discover(".", pattern="test_*.py")
    
    start_time = time.time()
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    duration = time.time() - start_time
    
    print("\n======================================================================")
    print(" ForgeHub E2E Test Report")
    print("======================================================================")
    print(f"Total tests run: {result.testsRun}")
    print(f"Time taken:      {duration:.2f}s")
    print(f"Passed:          {result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped)}")
    print(f"Failed:          {len(result.failures)}")
    print(f"Errors:          {len(result.errors)}")
    print(f"Skipped:         {len(result.skipped)}")
    
    if result.wasSuccessful():
        print("\nSTATUS: PASS ✅")
        sys.exit(0)
    else:
        print("\nSTATUS: FAIL ❌")
        sys.exit(1)

if __name__ == "__main__":
    run_all()
