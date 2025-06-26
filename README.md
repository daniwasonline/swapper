# Swapper

A REST API for easily swapping between virtual machines on a personal Proxmox virtualisation host. Useful for certain niche cases, i.e. single-GPU IOMMU, where you have a single GPU and want to swap peripherals between virtual machines.

## Roadmap
- [x] REST API to swap between virtual machines
  - [x] Fast caching for burst requests
  - [x] Basic bearer authentication
  - [ ] More advanced security & authentication
  - [ ] Support for access with scoped Proxmox VE token/users
  - [ ] Configurable rate limiting
- [ ] API frontend applications
  - [ ] Web UI (probably written in React?)
  - [ ] Command-line tooling
  - [ ] Apple shortcut (😭)
- [x] Automatically detect swappable machines with a tag
- [x] Easy to use JSON5 configuration (in VM notes)
- [ ] Device management
  - [x] USB device support
  - [ ] PCI(e) device support (\* API prepared but not implemented at this point)
  - [x] Hot-plug (automatically remove/add device to active VM as it's plugged in/out)
  - [x] Dynamic loading on startup (only load devices connected to host on startup)

## Usage
To use Swapper, you'll need:
- Bun.js (https://bun.sh/)
- Proxmox VE 8.0+ (https://pve.proxmox.com/)
- Valkey (https://valkey.io/) 7.0+ or compatible equivalent with Redis 2.6+
  - **No persistence is required**: KV is ephemeral and is only used for queue/messaging, caching, and state.

### Manual installation
- Clone this repository
- Install dependencies with `bun install`
- Copy `.example.env` to `.env.local` and fill in details
- Run with `bun run src/index.ts`
- Access the API at `http://127.0.0.1:8555/`

### Docker installation
- **Compose**: Refer to `example.docker-compose.yml`.
- **`docker run`**: No instructions at this time (coming whenever, submit a PR!)

### Configuration
Swappable QMs are automatically detected based on tags. Assign a QEMU machine with the tag `swapper` to mark it as swappable.

Configurations are managed with a [JSON5](https://json5.org/) snippet, located in the notes of a swappable QM. The configuration is parsed with special markers. See the [examples folder](examples) to see how this works.

## Questions & Troubleshooting
### Why is Swapper consistently hitting my Proxmox instance?
Swapper continuously polls your Proxmox instance for changes in host configuration, as well as to update the cache. Some of these intensive features (i.e. the event handler) cannot be disabled at the moment; I may add configuration options to disable them in the future.

In the mean time, you should probably disable any rate limiting for the API on your Proxmox instance or intermediate proxies.
### I can't use PCI(e) devices in the Swapper configuration!
In its' current state, Swapper only manages USB devices. I'll probably add support for PCI devices in the future, but I personally haven't had the need for swapper to manage PCI devices just yet.
### What authentication methods are supported?
At the moment, Swapper only uses Bearer authentication. When this isn't configured, the API is only accessible from localhost.
### I found a bug/have a feature request/whatever!
Please open an issue or pull request.

## Personal motivation
*This is a long-winded one, bear with me.*

I've dreamed of having a hypervisor setup on my PC for a *very long time* (since 2020), mostly because I wanted to have fast access to multiple OSes--essentially a fancier version of dual-boot. When I first thought of the idea, I didn't have sufficient resources (RAM, storage, nor CPU) to run anything like this; however, time's passed, and I now have a very capable machine with very capable hardware.

I switched from Windows 11 to a Proxmox-based setup in 2025. However, I ran into three huge issues:
- I couldn't easily switch between VMs: I had to manually stop the running VM with Proxmox before starting another one
- I swap my USB accessories between my MacBook and my PC, and Proxmox made it a huge pain in the ass to boot a VM without everything plugged in (please add the ability to boot a VM without a configured USB device plugged in, Proxmox!!!)

For this reason, I wrote Swapper 1.0: a Bash script that would stop a runnable VM, remove my keyboard, mouse, and microphone from it (in case I wanted to start the VM without the devices), then start another VM. This worked fine, mostly getting me through the remainder of the academic year. Fast-forward to now (June 2025), and I now have far more free time on my hands.

As said before, Swapper 1.0 worked fine, but it was *sloooow*. The script took about 10 seconds to place the initial swap request, and my primary means of accessing Swapper (an Apple Shortcut with SSH) made that far slower than I wanted it to be. I also wanted to have hot-plug and dynamic device sync (i.e. remove USB device => automatically remove from the VM), so I decided to rewrite Swapper 2.0 as a REST API--in spaghetti TypeScript, with Hono, on Bun, mostly because I cba to write a more elegant solution in Rust or Go or whatever.

Could it be better? Yep. Is it better than Swapper 1.0? Absolutely.