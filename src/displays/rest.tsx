import {
  Account,
  AccountQuery,
  Address,
  Algorithm,
  BlockchainConnection,
  PubkeyBundle,
  PubkeyBytes,
} from "@iov/bcp";
import { BnsConnection, BnsUsernameNft, pubkeyToAddress as bnsPubkeyToAddress } from "@iov/bns";
import { Bip39, EnglishMnemonic, Slip10RawIndex } from "@iov/crypto";
import { Bech32, Encoding } from "@iov/encoding";
import { pubkeyToAddress as ethereumPubkeyToAddress, toChecksummedAddress } from "@iov/ethereum";
import { Ed25519HdWallet, Secp256k1HdWallet } from "@iov/keycontrol";
import { LiskConnection, passphraseToKeypair, pubkeyToAddress as liskPubkeyToAddress } from "@iov/lisk";
import React from "react";
import { Link } from "react-router-dom";

import { printAmount, printPath } from "../bcphelpers";
import { HdCoin, NetworkSettings } from "../settings";
import { addressLink, ellideMiddle, printEllideMiddle } from "../uielements";
import { InteractiveDisplay, priorities, StaticDisplay } from ".";

const { fromHex, toHex } = Encoding;

const bcpConnections = new Map<string, Promise<BlockchainConnection>>();
const bnsConnections = new Map<string, Promise<BnsConnection>>();

function makeIovAccountDisplayImpl(
  id: string,
  priority: number,
  interpretedAs: string,
  query: AccountQuery,
  network: NetworkSettings,
  deprecated = false,
): InteractiveDisplay {
  return {
    id: id,
    priority: priority,
    deprecated: deprecated,
    interpretedAs: interpretedAs,
    getData: async () => {
      if (!bnsConnections.has(network.url)) {
        bnsConnections.set(network.url, BnsConnection.establish(network.url));
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const connection = await bnsConnections.get(network.url)!;
      const response = await connection.getAccount(query);
      if (response) {
        const names = await connection.getUsernames({ owner: response.address });
        return {
          account: response,
          names: names,
        };
      } else {
        return undefined;
      }
    },
    renderData: (
      response: { readonly account: Account; readonly names: readonly BnsUsernameNft[] } | undefined,
    ) => {
      let data: JSX.Element;
      if (response) {
        const { address, pubkey, balance } = response.account;
        const hexPubkey = pubkey ? toHex(pubkey.data) : undefined;

        const nameElements = response.names.map(name => (
          <span key={name.id}>
            <Link to={"#" + name.id}>{ellideMiddle(name.id, 40)}</Link>
            <br />
          </span>
        ));
        data = (
          <table>
            <tbody>
              <tr>
                <td>Address</td>
                <td>{addressLink(address)}</td>
              </tr>
              <tr>
                <td>Pubkey</td>
                <td className="breakall">
                  {hexPubkey ? (
                    <Link to={"#" + hexPubkey}>{hexPubkey}</Link>
                  ) : (
                    <span className="inactive">not available</span>
                  )}
                </td>
              </tr>
              <tr>
                <td>Balance</td>
                <td>{balance.map(printAmount).join(", ")}</td>
              </tr>
              <tr>
                <td>Names</td>
                <td>{nameElements}</td>
              </tr>
            </tbody>
          </table>
        );
      } else {
        data = <span className="inactive">Account not found</span>;
      }
      return { id, interpretedAs, priority, deprecated, data };
    },
  };
}

export function makeIovAccountDisplay(input: string, network: NetworkSettings): InteractiveDisplay {
  const id = `${input}#${network.name}-bns-account`;
  const interpretedAs = `Account on ${network.name}`;
  return makeIovAccountDisplayImpl(
    id,
    priorities.bnsAddress,
    interpretedAs,
    { address: input as Address },
    network,
  );
}

export function makeLiskAccountDisplay(input: string, network: NetworkSettings): InteractiveDisplay {
  const id = `${input}#${network.name}-lisk-account`;
  const interpretedAs = `Account on ${network.name}`;
  return {
    id: id,
    priority: priorities.liskAddress,
    interpretedAs: interpretedAs,
    getData: async () => {
      if (!bcpConnections.has(network.url)) {
        bcpConnections.set(network.url, LiskConnection.establish(network.url));
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const connection = await bcpConnections.get(network.url)!;
      const response = await connection.getAccount({ address: input as Address });
      return response;
    },
    renderData: (response: Account | undefined) => {
      let data: JSX.Element;
      if (response) {
        const { address, pubkey, balance } = response;
        const hexPubkey = pubkey ? toHex(pubkey.data) : undefined;
        data = (
          <table>
            <tr>
              <td>Address</td>
              <td>{addressLink(address)}</td>
            </tr>
            <tr>
              <td>Pubkey</td>
              <td className="breakall">
                {hexPubkey ? (
                  <Link to={"#" + hexPubkey}>{hexPubkey}</Link>
                ) : (
                  <span className="inactive">not available</span>
                )}
              </td>
            </tr>
            <tr>
              <td>Balance</td>
              <td>{balance.map(printAmount).join(", ")}</td>
            </tr>
          </table>
        );
      } else {
        data = <span className="inactive">Account not found</span>;
      }
      return {
        id: id,
        interpretedAs: interpretedAs,
        priority: priorities.liskAddress,
        data: data,
      };
    },
  };
}

export function makeIovUsernameDisplay(input: string, network: NetworkSettings): InteractiveDisplay {
  const displayId = `${input}#${network.name}-username`;
  const interpretedAs = `Username on ${network.name}`;
  return {
    id: displayId,
    priority: priorities.bnsUsername,
    interpretedAs: interpretedAs,
    getData: async () => {
      if (!bnsConnections.has(network.url)) {
        bnsConnections.set(network.url, BnsConnection.establish(network.url));
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const connection = await bnsConnections.get(network.url)!;
      const response = await connection.getUsernames({ username: input });
      return response;
    },
    renderData: (response: readonly BnsUsernameNft[]) => {
      let data: JSX.Element;
      if (response.length > 0) {
        const { id, owner, targets } = response[0];
        const addressElements = targets.map(pair => (
          <span key={pair.chainId}>
            {printEllideMiddle(pair.chainId, 12)}: {addressLink(pair.address)}
            <br />
          </span>
        ));
        data = (
          <table>
            <tbody>
              <tr>
                <td>Name</td>
                <td>
                  <Link to={"#" + id}>{id}</Link>
                </td>
              </tr>
              <tr>
                <td>Owner</td>
                <td>
                  <Link to={"#" + owner}>{owner}</Link>
                </td>
              </tr>
              <tr>
                <td>Addresses</td>
                <td>{addressElements}</td>
              </tr>
            </tbody>
          </table>
        );
      } else {
        data = <span className="inactive">Username not found</span>;
      }
      return {
        id: displayId,
        interpretedAs: interpretedAs,
        priority: priorities.bnsUsername,
        data: data,
      };
    },
  };
}

export function makeBech32Display(input: string): StaticDisplay {
  const parsed = Bech32.decode(input);
  return {
    id: `${input}#bech32`,
    interpretedAs: "Bech32 address",
    priority: priorities.bech32,
    data: (
      <div>
        Prefix: {parsed.prefix}
        <br />
        Data: <Link to={"#" + toHex(parsed.data)}>{toHex(parsed.data)}</Link>
      </div>
    ),
  };
}

export function makeHexDisplay(input: string): StaticDisplay {
  const inputData = Encoding.fromHex(input);
  return {
    id: `${input}#hex-summary`,
    interpretedAs: "Hex data summary",
    priority: priorities.hex,
    data: (
      <div>
        Length: {inputData.length} bytes
        <br />
        <div className="pair">
          <div className="pair-key">Lower:&nbsp;</div>
          <div className="pair-value data">{input.toLowerCase()}</div>
        </div>
        <div className="pair">
          <div className="pair-key">Upper:&nbsp;</div>
          <div className="pair-value data">{input.toUpperCase()}</div>
        </div>
      </div>
    ),
  };
}

export function makeEthereumAddressDisplay(input: string): StaticDisplay {
  const lower = input.toLowerCase();
  const checksummed = toChecksummedAddress(input);
  return {
    id: `${input}#ethereum-address`,
    interpretedAs: "Ethereum address",
    priority: priorities.ethereumAddress,
    data: (
      <div>
        <div className="pair">
          <div className="pair-key">Lower:&nbsp;</div>
          <div className="pair-value data">{lower}</div>
        </div>
        <div className="pair">
          <div className="pair-key">Checksummed:&nbsp;</div>
          <div className="pair-value data">{checksummed}</div>
        </div>
        <div>
          View on Etherscan:&nbsp;
          <a className="external" href={"https://ropsten.etherscan.io/address/" + checksummed}>
            Ropsten
          </a>
          &nbsp;
          <a className="external" href={"https://rinkeby.etherscan.io/address/" + checksummed}>
            Rinkeby
          </a>
          &nbsp;
          <a className="external" href={"https://etherscan.io/address/" + checksummed}>
            Mainnet
          </a>
        </div>
      </div>
    ),
  };
}

export function makeEd25519PubkeyDisplay(input: string): StaticDisplay {
  const pubkey: PubkeyBundle = {
    algo: Algorithm.Ed25519,
    data: Encoding.fromHex(input) as PubkeyBytes,
  };

  const iovTestAddress = bnsPubkeyToAddress(pubkey, "tiov");
  const iovMainAddress = bnsPubkeyToAddress(pubkey, "iov");
  const liskAddress = liskPubkeyToAddress(pubkey.data);

  return {
    id: `${input}#ed25519-pubkey`,
    interpretedAs: "Ed25519 public key",
    priority: priorities.ed25519Pubkey,
    data: (
      <div>
        IOV main: <Link to={"#" + iovMainAddress}>{iovMainAddress}</Link>
        <br />
        IOV test: <Link to={"#" + iovTestAddress}>{iovTestAddress}</Link>
        <br />
        Lisk: <Link to={"#" + liskAddress}>{liskAddress}</Link>
        <br />
      </div>
    ),
  };
}

export function makeSecp256k1PubkeyDisplay(input: string): StaticDisplay {
  const pubkey: PubkeyBundle = {
    algo: Algorithm.Secp256k1,
    data: Encoding.fromHex(input) as PubkeyBytes,
  };

  const ethereumAddress = ethereumPubkeyToAddress(pubkey);

  return {
    id: `${input}#secp256k1-pubkey`,
    interpretedAs: "Secp256k1 public key",
    priority: priorities.secp256k1Pubkey,
    data: (
      <div>
        Ethereum: <Link to={"#" + ethereumAddress}>{ethereumAddress}</Link>
        <br />
      </div>
    ),
  };
}

export function makeEd25519PrivkeyDisplay(input: string): StaticDisplay {
  const seed = fromHex(input).slice(0, 32);
  const pubkey = fromHex(input).slice(32, 64) as PubkeyBytes;

  return {
    id: `${input}#ed25519-privkey`,
    interpretedAs: "Ed25519 private key (libsodium format)",
    priority: priorities.ed25519Pivkey,
    data: (
      <div>
        <div className="pair">
          <div className="pair-key">Seed:&nbsp;</div>
          <div className="pair-value data">{toHex(seed)}</div>
        </div>
        <div>
          Pubkey: <Link to={"#" + toHex(pubkey)}>{printEllideMiddle(toHex(pubkey), 40)}</Link>
        </div>
      </div>
    ),
  };
}

function makeHdAddressesDisplay(
  id: string,
  interpretedAs: string,
  addresses: readonly {
    readonly path: string;
    readonly pubkey: PubkeyBundle;
    readonly address: Address;
  }[],
  addressLength: number,
  deprecated?: boolean,
): StaticDisplay {
  const rows = addresses.map(a => (
    <div key={a.path}>
      <span className="mono">{a.path}</span>:{" "}
      <Link to={"#" + a.address}>{ellideMiddle(a.address, addressLength)}</Link> ({a.pubkey.algo}/
      <Link to={"#" + toHex(a.pubkey.data)}>{ellideMiddle(toHex(a.pubkey.data), 5)}</Link>)
    </div>
  ));

  return {
    id: id,
    interpretedAs: interpretedAs,
    priority: priorities.hdAddresses,
    deprecated: deprecated,
    data: <div>{rows}</div>,
  };
}

export async function makeEd25519HdWalletDisplay(input: string, coin: HdCoin): Promise<StaticDisplay> {
  const { number: coinNumber, name: coinName, chainId, codec } = coin;

  const wallet = Ed25519HdWallet.fromMnemonic(input);

  // tslint:disable-next-line:readonly-array
  const addresses: {
    readonly path: string;
    readonly pubkey: PubkeyBundle;
    readonly address: Address;
  }[] = [];
  for (let a = 0; a < 5; ++a) {
    const path: readonly Slip10RawIndex[] = [
      Slip10RawIndex.hardened(44),
      Slip10RawIndex.hardened(coinNumber),
      Slip10RawIndex.hardened(a),
    ];
    const identity = await wallet.createIdentity(chainId, path);
    const address = codec.identityToAddress(identity);
    addresses.push({
      path: printPath(path),
      pubkey: identity.pubkey,
      address: address,
    });
  }

  return makeHdAddressesDisplay(
    `${input}#hd-wallet-coin${coinNumber}`,
    `${coinName} HD Wallet`,
    addresses,
    21,
  );
}

export async function makeSecp256k1HdWalletDisplay(input: string, coin: HdCoin): Promise<StaticDisplay> {
  const { number: coinNumber, name: coinName, chainId, codec } = coin;

  const wallet = Secp256k1HdWallet.fromMnemonic(input);

  // tslint:disable-next-line:readonly-array
  const addresses: {
    readonly path: string;
    readonly pubkey: PubkeyBundle;
    readonly address: Address;
  }[] = [];
  for (let a = 0; a < 5; ++a) {
    const path: readonly Slip10RawIndex[] = [
      Slip10RawIndex.hardened(44),
      Slip10RawIndex.hardened(coinNumber),
      Slip10RawIndex.hardened(0),
      Slip10RawIndex.normal(0),
      Slip10RawIndex.normal(a),
    ];
    const identity = await wallet.createIdentity(chainId, path);
    const address = codec.identityToAddress(identity);
    addresses.push({
      path: printPath(path),
      pubkey: identity.pubkey,
      address: address,
    });
  }

  return makeHdAddressesDisplay(
    `${input}#hd-wallet-coin${coinNumber}`,
    `${coinName} HD Wallet`,
    addresses,
    16,
  );
}

export async function makeLiskLikePassphraseDisplay(input: string): Promise<StaticDisplay> {
  const liskAddress = liskPubkeyToAddress((await passphraseToKeypair(input)).pubkey);

  return {
    id: `${input}#lisk-like-passphrase`,
    interpretedAs: "Lisk-like passphrase",
    priority: priorities.liskLikePassphrase,
    data: (
      <div>
        Lisk: <Link to={"#" + liskAddress}>{liskAddress}</Link>
        <br />
      </div>
    ),
  };
}

export function makeBip39MnemonicDisplay(input: string): StaticDisplay {
  const mnemonic = new EnglishMnemonic(input);
  const entropy = Bip39.decode(mnemonic);

  let wordCount: number;
  switch (entropy.length * 8) {
    case 128:
      wordCount = 12;
      break;
    case 160:
      wordCount = 15;
      break;
    case 192:
      wordCount = 18;
      break;
    case 224:
      wordCount = 21;
      break;
    case 256:
      wordCount = 24;
      break;
    default:
      throw new Error("Unsupported entropy length");
  }

  return {
    id: `${input}#bip39-english-mnemonic`,
    interpretedAs: "Bip39 english mnemonic",
    priority: priorities.bip39Mnemonic,
    data: (
      <div>
        Words: {wordCount}
        <br />
        ENT: {entropy.length * 8}
        <br />
        <div className="pair">
          <div className="pair-key">Entropy:&nbsp;</div>
          <div className="pair-value data">{toHex(entropy)}</div>
        </div>
      </div>
    ),
  };
}
