# assert-evm

> chai matchers for evm/ethereum

## Usage


``` ts
import chai from "chai";
import { evm } from "assert-evm";

chai.use(evm);
```

Below is the list of available matchers:

### Bignumbers

Testing equality of big numbers:

``` ts
expect(await token.balanceOf(wallet.address)).to.equal(993);
```

Available matchers for BigNumbers are: <span
class="title-ref">equal</span>, <span class="title-ref">eq</span>, <span
class="title-ref">above</span>, <span class="title-ref">gt</span>, <span
class="title-ref">gte</span>, <span class="title-ref">below</span>,
<span class="title-ref">lt</span>, <span class="title-ref">lte</span>,
<span class="title-ref">least</span>, <span
class="title-ref">most</span>, <span class="title-ref">within</span>,
<span class="title-ref">closeTo</span>.

``` ts
expect(BigNumber.from(100)).to.be.within(BigNumber.from(99), BigNumber.from(101));
expect(BigNumber.from(100)).to.be.closeTo(BigNumber.from(101), 10);
```

## Emitting events

Testing what events were emitted with what arguments:

``` ts
await expect(token.transfer(walletTo.address, 7))
  .to.emit(token, 'Transfer')
  .withArgs(wallet.address, walletTo.address, 7);
```

<div class="note">

<div class="title">


</div>

> Note The matcher will match `indexed` event parameters of type `string` or
> `bytes` even if the expected argument is not hashed using `keccack256` first.

</div>

Testing with indexed bytes or string parameters. These two examples are
equivalent

``` ts
await expect(contract.addAddress("street", "city"))
  .to.emit(contract, 'AddAddress')
  .withArgs("street", "city");

const hashedStreet = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("street"));
const hashedCity = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("city"));
await expect(contract.addAddress(street, city))
  .to.emit(contract, 'AddAddress')
  .withArgs(hashedStreet, hashedCity);
```

## Called on contract

Testing if function was called on the provided contract:

``` ts
await token.balanceOf(wallet.address)

expect('balanceOf').to.be.calledOnContract(token);
```

## Called on contract with arguments

Testing if function with certain arguments was called on provided
contract:

``` ts
await token.balanceOf(wallet.address)

expect('balanceOf').to.be.calledOnContractWith(token, [wallet.address]);
```

### Revert

Testing if transaction was reverted:

``` ts
await expect(token.transfer(walletTo.address, 1007)).to.be.reverted;
```

### Revert with message

Testing if transaction was reverted with certain message:

``` ts
await expect(token.transfer(walletTo.address, 1007))
  .to.be.revertedWith('Insufficient funds');
```

### Change ether balance

Testing whether the transaction changes the balance of the account:

``` ts
await expect(() => wallet.sendTransaction({to: walletTo.address, value: 200}))
  .to.changeEtherBalance(walletTo, 200);

await expect(await wallet.sendTransaction({to: walletTo.address, value: 200}))
  .to.changeEtherBalance(walletTo, 200);
```

## License

MIT,
Extracted from `ethereum-waffle`, [see original docs](https://ethereum-waffle.readthedocs.io/en/latest/matchers.html)
