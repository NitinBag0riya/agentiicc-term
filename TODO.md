# Project TODOs

## Advanced Trading Features (Validation Needed)

- [ ] **Aster Adapter**: Validate `PostOnly` (GTX) behavior. Test script showed order was accepted instead of rejected when crossing spread.
- [ ] **Aster Adapter**: Validate `IOC` (Immediate-Or-Cancel). Test script showed order remained `NEW` instead of cancelling immediately.
- [x] **Hyperliquid Trading**: Implement `placeOrder` and `cancelOrder` with msgpack/signing (Done: Used `hyperliquid` SDK).
- [x] **Hyperliquid Testing**: Create `live-test-hyperliquid.ts` (Done: Tested with Read-Only successfully).
- [ ] **Aster GTX/IOC Check**: Investigate why PostOnly/IOC behaves oddly on Aster (Pending).).
- [ ] **Unified API**: Ensure consistent behavior for `timeInForce` across all adapters.
