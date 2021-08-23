import { Servient, Helpers } from "@node-wot/core";
import { HttpClientFactory } from "@node-wot/binding-http";
import { CoapClientFactory } from "@node-wot/binding-coap"
import speedtest = require("speedtest-net")

class ThingConfiguration {
  protocol = "";
  address = "";
  ipv6 = true;

  constructor(protocol: string, address: string, ipv6: boolean) {
    this.protocol = protocol;
    this.address = address;
    this.ipv6 = ipv6;
  }
}

const textTime = 10000;
const numberTime = 20000;
const thingConfig: ThingConfiguration = new ThingConfiguration(
  "http://",
  "192.168.178.27",
  false
);

const servient = new Servient();
if (thingConfig.protocol == "http://") {
  servient.addClientFactory(new HttpClientFactory());
} else if (thingConfig.protocol == "coap://") {
  servient.addClientFactory(new CoapClientFactory());
}

const wotHelper = new Helpers(servient);

interface DisplayResponse {
  status: string;
}

interface ActionResponse {
  display: DisplayResponse;
}

async function getTimeoutPromise(
  data: [WoT.ConsumedThing, speedtest.ResultEvent],
  timeout: number
): Promise<[WoT.ConsumedThing, speedtest.ResultEvent]> {
  return await new Promise((resolve) => {
    setTimeout(() => {
      resolve(data);
    }, timeout);
  });
}

async function consumeThing([speedtest, td, wot]: [
  speedtest.ResultEvent,
  WoT.ThingDescription,
  WoT.WoT
]): Promise<[WoT.ConsumedThing, speedtest.ResultEvent]> {
  return [await wot.consume(td), speedtest];
}

class DisplayContent {
  headline: string
  subheadline: string
  body: string

  constructor(headline: string, subheadline: string, body: string){
    this.headline = headline
    this.subheadline = subheadline
    this.body = body
  }
}

function setDisplayTo(thing: WoT.ConsumedThing, content: DisplayContent) {
  const result: Promise<ActionResponse> = thing.invokeAction("display", content) as Promise<ActionResponse>;

  result
    .then((result) => {
      if (result.display.status == "created") {
        console.log(`Showing content was successful`);
        console.log(content)
      } else {
        console.warn(`Showing content failed`);
        console.warn(content)
      }
    })
    .catch((err) => {
      console.error("setDisplay error:", err);
    });
}

function runSpeedtest() {
  console.log("Speedtest is running...")
  return speedtest()
}

const thingAddress: string = thingConfig.ipv6
  ? `[${thingConfig.address}]`
  : thingConfig.address;
const responses = Promise.all([
  runSpeedtest(),
  wotHelper.fetch(
    `${thingConfig.protocol}${thingAddress}/.well-known/wot-thing-description`
  ),
  servient.start(),
]);

const consumeThingResponse = responses.then(consumeThing);

consumeThingResponse.catch((err) => {
  console.error("Consumed Thing error:", err);
});

consumeThingResponse
  .then(async ([thing, speedtest]) => {
    const content = new DisplayContent(
      'Ping',
      speedtest.server.location, 
      `${speedtest.ping.latency} ms`
      )
    setDisplayTo(thing, content);
    return getTimeoutPromise([thing, speedtest], textTime);
  })
  .then(async ([thing, speedtest]) => {
    const content = new DisplayContent(
      'Download', 
      speedtest.server.location, 
      `${(speedtest.download.bandwidth*8 / 1000000).toFixed(2)} mbit/s`
      )
    setDisplayTo(thing, content);
    return getTimeoutPromise([thing, speedtest], textTime);
  })
  .then(async ([thing, speedtest]) => {
    const content = new DisplayContent(
      'Upload', 
      speedtest.server.location, 
      `${(speedtest.upload.bandwidth*8 / 1000000).toFixed(2)} mbit/s`
      )
    setDisplayTo(thing, content);
    return getTimeoutPromise([thing, speedtest], textTime);
  })
  .catch((err) => {
    console.error("Fetch error:", err);
  });
