> **DRIVE IMPORT — DESIGN-INTENT REFERENCE (NOT A SPEC)**
>
> Source: Google Drive — "Tri-State Engineering 3D Simulator — PTDT v32 Sovereign Platform Specification.pdf" · Drive last modified: 2026-07-18
> Ingested: 2026-09-25 · Verification status: **DESIGN-INTENT**
>
> This document describes intended or aspirational system behavior from the owner's design
> archive. It does NOT describe implemented code. Per `SYNTHESIS-VERIFICATION.md`, several
> Drive-side claims (multi-physics engines, solver rates, sealed certifications, "sovereign"
> infrastructure) overstate implementation maturity. Do NOT treat values, certifications, or
> system descriptions here as verified engineering data or as specifications for new work.

---
Tri-State Engineering Division · Platform Engineering Group

Tri-State Engineering3D Simulator

PTDT v32 Sovereign Platform Specification
Document ID
TSE-PTDT-v32-SPS-001
Version
v1.0.0
Date
July 15, 2026
Prepared By
Tri-State Engineering Division — Platform Engineering Group
Reviewed By
Systems Architecture Review Board (SARB)
Approved By
Chief Platform Officer, Tri-State Engineering
Status
Released — Active Reference
■ Internal — Engineering Confidential

Document Control

Revision History
Version
Date
Author
Description
v0.1.0
2026-03-10
A. Tucker, Platform Eng.
Initial draft — architecture and rendering sections
v0.5.0
2026-05-02
A. Tucker, Platform Eng.
Physics, UI, backend integration added; internal review
v0.9.0
2026-06-20
A. Tucker / SARB
Security model, SLAs, testing chapters; SARB review cycle 1
v1.0.0
2026-07-15
A. Tucker / Platform Eng.
Final release — all sections complete, SARB-approved

⚠ Classification Notice
This document is classified
Internal — Engineering Confidential
. Distribution is restricted to credentialed members of the Tri-State Engineering
Platform Engineering Group, Systems Architecture Review Board, and authorized
project stakeholders. Unauthorized reproduction, distribution, or disclosure is
prohibited under Tri-State Engineering Information Security Policy §4.2.

Table of Contents
1. Executive Summary .................................................................................................... 6
1.1 Purpose and Scope
1.2 3D Simulator Subsystem Overview
1.3 Key Design Principles
1.4 Audience and Document Conventions

2. System Architecture Overview .................................................................................... 8
2.1 High-Level Layered Architecture
2.2 Sovereign Isolation Model
2.3 Inter-Module Communication
2.4 Technology Stack
2.5 Dependency Manifest Overview

3. Module Layout ......................................................................................................... 12
3.1 Directory and Namespace Structure
3.2 Module Registry and Versioning
3.3 Core Module Descriptions
3.4 Inter-Module Dependency Graph
3.5 Module Lifecycle

4. Rendering Pipeline ................................................................................................... 17
4.1 Pipeline Overview
4.2 Rendering API and Backend Selection
4.3 Multi-Pass Architecture
4.4 Frame Budget
4.5 Level-of-Detail System
4.6 Culling System
4.7 Shader Management
4.8 GPU Memory Management
4.9 GPU Profiling Hooks

5. Physics Models ........................................................................................................ 23
5.1 Physics Solver Architecture
5.2 Rigid Body Dynamics
5.3 Soft Body Simulation
5.4 Fluid Simulation
5.5 Thermal Physics Model
5.6 Electromagnetic Field Model
5.7 Constraint System
5.8 Material Property Database
5.9 Determinism Guarantees
5.10 Multi-Threading Model

6. UI System ................................................................................................................. 30
6.1 UI Framework Architecture
6.2 Widget Library
6.3 HUD System
6.4 Layout Engine
6.5 Input Handling
6.6 Theming System
6.7 Localization
6.8 Accessibility
6.9 Developer Tooling
6.10 State Binding

7. Backend Integration ................................................................................................. 35
7.1 Integration Bus Architecture
7.2 Data Ingestion
7.3 Telemetry Export
7.4 REST API Surface
7.5 Authentication and Authorization
7.6 Data Sovereignty Controls
7.7 Schema Registry
7.8 Event Streaming
7.9 Audit Trail

8. Operational Workflows ............................................................................................ 41
8.1 Simulation Lifecycle Workflow
8.2 Scenario Management
8.3 Asset Pipeline Workflow
8.4 Snapshot and Replay
8.5 Operator Runbook
8.6 Upgrade and Patching Workflow
8.7 Disaster Recovery
8.8 Multi-Operator Collaboration
8.9 CI/CD Integration

9. Security and Sovereignty Model ............................................................................... 48
9.1 Sovereign Platform Definition
9.2 Threat Model
9.3 Secure Boot Chain
9.4 Encryption
9.5 Key Management
9.6 Access Control
9.7 Audit Logging
9.8 Vulnerability Management

10. Performance Targets and SLAs ................................................................................ 53
10.1 Simulation Tick Rates
10.2 Frame Time Budget

10.3 Memory Budget
10.4 Startup and Recovery Targets
10.5 Throughput and Latency SLAs

11. Testing and Validation ............................................................................................ 57
11.1 Test Pyramid
11.2 Determinism Test Suite
11.3 Physics Validation
11.4 Rendering Validation
11.5 Performance Benchmarks
11.6 Fault Injection Testing
11.7 Module Acceptance Criteria

12. Glossary and Acronym Table ................................................................................... 63

1. Executive Summary
1.1 Purpose and Scope
This document constitutes the authoritative technical specification for the Tri-State Engineering 3D
Simulator operating on the PTDT v32 Sovereign Platform. It defines the complete architecture, module
design, interface contracts, performance requirements, security model, and operational procedures
governing the platform. The specification is binding for all engineering development, integration, and
deployment activities associated with PTDT v32.
The PTDT v32 (Platform for Trusted Deterministic Telemetry, version 32) is a sovereign, air-gapped
simulation execution environment designed to support high-fidelity, real-time 3D simulation of complex
engineering systems. Version 32 represents a generational advancement over PTDT v28, introducing a
fully redesigned rendering pipeline based on Vulkan 1.3, a new multi-threaded physics solver cluster, a
sovereign data-isolation bus, and a redesigned audit subsystem with Merkle-tree integrity proofs.
The scope of this specification covers:

● All software layers from the Hardware Abstraction Layer (HAL) through the operator-facing UI
● The physics, rendering, and simulation execution subsystems

● Backend integration, telemetry, and data sovereignty controls
● Security, access control, and audit architecture
● Performance SLAs, test requirements, and operational runbooks
Out of scope: physical hardware procurement specifications, network infrastructure design, and thirdparty SCADA system integration (addressed in companion document TSE-PTDT-v32-INT-002).

1.2 3D Simulator Subsystem Overview
The Tri-State Engineering 3D Simulator is the primary human-machine interface and visualization layer
of the PTDT v32 platform. It renders deterministic, physics-accurate 3D representations of simulated
engineering environments — including structural, mechanical, thermal, fluid, and electromagnetic
systems — at production-grade visual fidelity targeting 60 frames per second at 4K (3840×2160)
resolution.
The simulator is not a game engine wrapper or a modified commercial product. It is a purpose-built,
sovereign simulation runtime engineered from the ground up to meet the stringent requirements of TriState Engineering operational contexts: deterministic replay, sovereign data containment, auditable
execution traces, and seamless integration with real-time sensor data feeds.
Key capabilities of the 3D Simulator subsystem include:

● Real-time physically-based rendering (PBR) with full deferred multi-pass pipeline
● 120 Hz fixed-timestep physics simulation with rigid body, soft body, fluid, thermal, and EM
models

● Deterministic, bit-exact replay from signed state snapshots
● Live telemetry injection from sensor feeds at up to 1 kHz sampling rate
● Configurable HUD with operator-defined data overlays and alert routing
● Scenario branching, merging, and time-scrub playback
● Sovereign audit trail on all simulation state transitions and operator actions

1.3 Key Design Principles

Principle

Definition

Architectural Consequence

Sovereignty

All data, compute, and telemetry remain
within the operator-controlled enclave at
all times.

Air-gapped deployment; no external SDK
telemetry; egress gating enforced at the OS
firewall and application layer.

Determinism

Given identical inputs and a signed
snapshot, the simulator must produce bitexact outputs on any conformant platform
instance.

IEEE 754 strict mode; fixed-seed RNG; locked
physics timestep; cross-platform replay
validation CI gate.

Modularity

Each subsystem is independently
versionable, testable, and replaceable
behind a stable ABI boundary.

Shared-library module registry; semantic
versioning with build hashes; contract-based
inter-module IPC.

Real-Time
Fidelity

Simulation must execute within
deterministic time bounds and never
sacrifice physical accuracy for throughput.

Hard real-time scheduling for physics solver
thread; GPU frame pre-emption controls; perpass time-budget enforcement with automatic
LOD fallback.

Auditability

Every platform action, state change, and
operator command must be traceable and
tamper-evident.

Append-only AuditLogger with Merkle-tree
proofs; platform-key transaction signing; SIEM
export pipeline.

Resilience

The platform must recover from hardware
and software faults within defined RTO
bounds.

60-second state checkpointing; checkpointbased crash recovery <30 s RTO; watchdog
supervisor process.

1.4 Audience and Document Conventions
This specification is written for senior software engineers, systems architects, platform leads, and
security engineers with prior experience in real-time simulation systems, GPU rendering pipelines, and
distributed systems engineering. Familiarity with C++20, Vulkan, and Linux systems programming is
assumed.
Document Conventions:

● Bold text denotes critical terms, required behavior, or defined identifiers on first use.
● Monospace text denotes code identifiers, file paths, configuration keys, and command-line
tokens.

● Section numbers are hierarchical (e.g., §4.3.2 refers to Section 4, subsection 3, sub-subsection
2).

● The keywords MUST, MUST NOT, SHOULD, MAY are used per RFC 2119 normative conventions
throughout this document.

● Version strings follow Semantic Versioning 2.0.0 (MAJOR.MINOR.PATCH).

ⓘ Document Status
This is a
Released
specification (v1.0.0). Changes require a formal Engineering Change Request
(ECR) submitted to the SARB. Minor errata may be addressed via patch releases
(e.g., v1.0.1) without full SARB review. Major architectural changes require a new
major version (v2.0.0).

2. System Architecture Overview
2.1 High-Level Layered Architecture
The PTDT v32 platform is organized as a strict seven-layer vertical stack. Each layer communicates
exclusively with its immediate neighbors through well-defined interface contracts. Cross-layer direct
coupling is prohibited by architectural policy and enforced by module boundary tests in CI.
┌─────────────────────────────────────────────────────────────────┐ │
LAYER 7: UI FRAMEWORK
│ │
HUD · Widgets · Layout
Engine · Input · Theming · Overlays
│
├─────────────────────────────────────────────────────────────────┤ │
LAYER 6: OPERATIONAL CONTROL PLANE
│ │ Scenario Mgmt ·
Operator Runbook · Session Locking · CI/CD
│
├─────────────────────────────────────────────────────────────────┤ │
LAYER 5: BACKEND INTEGRATION BUS
│ │ ZeroMQ/gRPC · REST
API · Telemetry Export · Schema Registry
│
├─────────────────────────────────────────────────────────────────┤ │
LAYER 4: RENDERING PIPELINE
│ │
Vulkan 1.3 · MultiPass · PBR · TAA · Post-Processing · LOD
│
├─────────────────────────────────────────────────────────────────┤ │
LAYER 3: PHYSICS ENGINE
│ │
RigidBody · SoftBody
· Fluid · Thermal · EM · Constraints
│
├─────────────────────────────────────────────────────────────────┤ │
LAYER 2: SIMULATION KERNEL
│ │ SimCore · SceneGraph ·
EventDispatcher · StateManager · Assets │
├─────────────────────────────────────────────────────────────────┤ │
LAYER 1: HARDWARE ABSTRACTION LAYER (HAL)
│ │
CPU Affinity ·
GPU Context · Memory Mgmt · I/O · Clocks
│
└─────────────────────────────────────────────────────────────────┘

│
│
┌──────┴───────┐
┌──────────┴──────────┐
│ HOST OS
│
│ SOVEREIGN
ENCLAVE │
│ Linux 6.x
│
│ TPM 2.0 · HSM
│
│ x86_64/ARM64│
│ AuditLogger · SIEM │
└──────────────┘
└─────────────────────┘

Layer responsibilities are strictly bounded: Layer N may call downward into Layer N-1 and receive
upward callbacks from Layer N+1, but MUST NOT reference internal symbols of non-adjacent layers.
This constraint is verified at link time using symbol visibility controls (-fvisibility=hidden) and
validated by the ABI compliance test suite.

2.2 Sovereign Isolation Model
The PTDT v32 platform is architected for deployment in a fully air-gapped sovereign enclave. The
isolation model has three enforcement tiers:

2.2.1 Network Isolation
The host machine operates with no external network interfaces enabled in production mode. All interservice communication within the enclave occurs over a loopback or private VLAN segment with no
routes to external networks. The OS-level firewall policy enforces an explicit deny-all-egress default,
with only audited exceptions for operator-approved internal endpoints.

2.2.2 Process Isolation
The simulation kernel, rendering pipeline, and backend bus each run as separate OS processes with
dedicated user accounts (ptdt-sim, ptdt-render, ptdt-bus) under least-privilege POSIX
permissions. Inter-process communication is conducted exclusively via the platform's zero-copy IPC
primitives (§2.3). No process may load unsigned shared libraries; the LD_AUDIT hook validates all
dynamic loads against the module manifest SHA-256 registry at startup.

2.2.3 Secure Enclave Execution
Cryptographic key operations and audit log signing are performed within a hardware-backed secure
enclave (TPM 2.0 + HSM, §9.3). Platform attestation measurements are taken at boot and compared
against the Golden Measurement Registry. Any deviation halts startup and triggers an incident alert to
the designated Security Operations contact.

■ Sovereign Restriction

No module, plugin, or configuration file loaded by PTDT v32 may contain a network
socket binding to any interface other than
127.0.0.1
or the designated internal VLAN prefix. Violations are caught by the startup preflight network audit and result in a hard abort with incident code
SOV-NET-001
.

2.3 Inter-Module Communication
PTDT v32 employs three IPC primitives, selected based on bandwidth, latency, and ordering
requirements:

Primitive

Implementation

Throughput

Latency

Use Cases

Shared
Memory Ring
Buffer

POSIX shm_open + lockfree SPSC/MPMC ring

>10 GB/s

<100 ns

Physics→Render state transfer;
sensor feed ingest; frame data

Zero-Copy IPC

Linux io_uring with
registered buffers

>2 GB/s

<2 µs

Asset streaming; large snapshot
transfers; telemetry bulk export

Event Bus

Custom pub-sub dispatcher
(EventDispatcher module)

~5M
events/s

<10 µs

Control commands; state change
notifications; UI data binding

2.3.1 Ring Buffer Layout
Physics-to-render shared memory ring buffers are 64 MB double-buffered regions allocated at startup
and pinned in physical memory (mlock). The physics solver writes to the back buffer at 120 Hz; the
renderer reads from the front buffer at 60 Hz. Buffer swap is signaled via a 64-bit atomic counter. No
mutexes are used on the hot path.
// Conceptual ring buffer header (tri_state::ptdt::ipc) struct
RingBufferHeader {
alignas(64) std::atomic<uint64_t> write_seq;
//
physics writer
alignas(64) std::atomic<uint64_t> read_seq;
// render
reader
uint32_t capacity_bytes;
uint32_t slot_size_bytes;
uint32_t slot_count;
uint8_t
_pad[52]; };

2.4 Technology Stack
Domain

Technology

Version

Role

Primary Language

C++

C++20 (ISO/IEC
14882:2020)

Simulation kernel, physics, rendering
backend, module framework

Systems Language

Rust

1.78 (stable)

AuditLogger, key management client,
IPC transport layer

Shader Language

GLSL / HLSL → SPIR-V

GLSL 4.60 / HLSL
SM 6.6

GPU compute and graphics shaders;
compiled offline to SPIR-V

Scripting /
Orchestration

Python

3.12

Build orchestration, CI scripting, asset
pipeline tooling

Rendering API
(Primary)

Vulkan

1.3.280

GPU rendering and compute on x86_64
targets

Rendering API
(Fallback)

Metal

3.1

GPU rendering on ARM64 / Apple Silicon
targets

Build System
(Primary)

CMake

3.28+

Module build configuration,
dependency resolution, install targets

Build System
(Monorepo)

Bazel

7.1

Hermetic monorepo builds, remote
cache, cross-compilation

IPC Transport

ZeroMQ / gRPC

ZMQ 4.3.5 / gRPC
1.64

Backend integration bus (operatorselectable at deploy time)

Serialization

Protocol Buffers

proto3 / protoc
26.1

All inter-service messages, snapshot
format, telemetry schema

Telemetry Storage

InfluxDB /
Prometheus

InfluxDB 2.7 / Prom
2.52

Time-series metrics export and alerting

Event Streaming

Apache Kafka

3.7

High-throughput event pipeline adapter

GPU Memory
Allocator

Vulkan Memory
Allocator (VMA)

3.1.0

GPU heap management, sub-allocation,
defragmentation

Physics Math

Eigen

3.4.0

Linear algebra, matrix operations for
physics solver

Target OS

Linux

Kernel 6.6 LTS

Primary deployment OS; PREEMPT_RT
patch for physics thread

Target Architecture

x86_64 / ARM64

—

x86_64 primary; ARM64 for field tablet
deployments

Compiler (C++)

Clang / GCC

Clang 18 / GCC 14

Clang preferred for LTO + ThinLTO; GCC
for ARM cross-compile

Test Framework

Google Test / Catch2

GTest 1.14 / Catch2
3.6

Unit and integration test harnesses

Localization
Runtime

ICU

74.2

Unicode, number/date formatting, RTL
layout support

2.5 Dependency Manifest Overview
All third-party dependencies are pinned by SHA-256 content hash in the platform's Software Bill of
Materials (SBOM), stored at third_party/SBOM.json and generated in CycloneDX 1.5 format. No
dependency is fetched from the internet at build time; all sources are mirrored in the sovereign Artifact
Registry at artifacts.internal.tri-state.eng.

▶ Supply Chain Policy
Adding, upgrading, or removing a third-party dependency requires a Supply Chain
Review (SCR) approval from the Platform Security team. All new dependencies
MUST pass the CVE triage checklist (§9.8) and MUST have available source code
for internal audit. Binary-only dependencies are prohibited without explicit SARB
waiver.

3. Module Layout
3.1 Directory and Namespace Structure
All platform source code resides in a single Bazel-managed monorepo. The canonical source tree is
organized as follows:
tri-state-ptdt/ ├── BUILD
# Bazel root ├──
CMakeLists.txt
# CMake root ├── WORKSPACE
# Bazel workspace ├── third_party/
# Mirrored vendor
sources + SBOM.json │ ├── platform/
# Platform core │
├── hal/
# Hardware Abstraction Layer │
│
├── cpu/
# CPU affinity, NUMA topology │
│
├── gpu/
# GPU
context init, Vulkan/Metal bootstrap │
│
├── memory/
#
Physical memory allocation, huge pages │
│
└── io/
#
File I/O, clock sources, timers │
│ │
├── kernel/
#
Simulation Kernel (Layer 2) │
│
├── sim_core/
# SimCore
orchestrator │
│
├── scene_graph/
# SceneGraph spatial
hierarchy │
│
├── event_dispatcher/
# EventDispatcher pub-sub │
│
├── state_manager/
# StateManager deterministic FSM │
│
└──
asset_manager/
# AssetManager + streaming cache │
│ │
├──

physics/
# Physics Engine (Layer 3) │
│
├── rigid_body/
│
│
├── soft_body/ │
│
├── fluid/ │
│
├── thermal/ │
│
├──
em_field/ │
│
└── constraints/ │
│ │
├── render/
#
Rendering Pipeline (Layer 4) │
│
├── vulkan/
# Vulkan
backend │
│
├── metal/
# Metal fallback backend │
│
├── passes/
# G-Buffer, Shadow, SSAO, Lighting, etc. │
│
├── shaders/
# GLSL/HLSL sources + SPIR-V cache │
│
└──
ui_composite/
# UI Composite Pass │
│ │
├── ui/
# UI Framework (Layer 7) │
│
├── widgets/ │
│
├── hud/ │
│
├──
layout/ │
│
├── input/ │
│
└── theme/ │
│ │
├── backend/
# Backend Integration Bus (Layer 5) │
│
├── bus/
#
ZeroMQ/gRPC transport │
│
├── ingest/
# Sensor feed
adapters │
│
├── telemetry/
# InfluxDB/Prometheus exporters │
│
├── rest_api/
# HTTP REST surface │
│
└── kafka/
# Kafka adapter │
│ │
└── control/
# Operational
Control Plane (Layer 6) │
├── scenario/ │
├── snapshot/ │
└── collaboration/ │ ├── security/
# Sovereign security
subsystem │
├── audit/
# AuditLogger (Rust) │
├──
keymgmt/
# HSM key management client (Rust) │
└── boot/
# Secure boot attestation │ ├── tools/
# Internal
engineering tools │
├── asset_pipeline/ │
├── benchmark/ │
└──
debug_inspector/ │ └── tests/
# All test targets
├── unit/
├── integration/
├── system/
└── regression/

The C++ namespace hierarchy mirrors the directory structure under a canonical root:
namespace tri_state {
namespace ptdt {
namespace v32 {
namespace
hal { /* cpu, gpu, memory, io */ }
namespace kernel { /* sim_core,
scene_graph, etc. */ }
namespace physics { /* rigid_body, soft_body,
etc. */ }
namespace render { /* vulkan, passes, shaders */ }
namespace ui { /* widgets, hud, layout */ }
namespace backend { /* bus,
ingest, telemetry */ }
namespace security { /* audit, keymgmt */ }
} // namespace v32
} // namespace ptdt } // namespace tri_state

3.2 Module Registry and Versioning
Each platform module is registered in the Module Registry — a JSON manifest loaded at startup by the
SimCore orchestrator. The registry maps module identifiers to shared library paths, interface versions,
and build hashes.
// Example module registry entry (registry.json) {
"modules": [
{
"id":
"tri_state.ptdt.v32.physics",
"display_name":
"PhysicsEngine",
"so_path":
"/opt/ptdt/lib/libphysics_engine.so.4.2.1",
"interface_ver": "4.2.1",
"build_hash":
"sha256:a3f8c2d1e9b74f0c8a1d2e3f4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3",
"requires": ["tri_state.ptdt.v32.hal", "tri_state.ptdt.v32.kernel"],
"init_priority": 200
}
] }

Version strings follow MAJOR.MINOR.PATCH semantics. The Module Registry enforces interface
compatibility: a module with interface version 4.x.x MUST NOT be loaded by a host expecting
interface version 3.x.x. Patch-level mismatches generate a warning; minor-level mismatches block
loading; major-level mismatches abort startup.

3.3 Core Module Descriptions
Module ID

Display Name

Primary
Language

Init
Priority

Description

ptdt.hal

HAL

C++20

100

Hardware abstraction: CPU
topology queries, GPU
context initialization
(Vulkan/Metal), physical
memory allocation, highresolution clock sources, and
kernel I/O interfaces. All
other modules depend on
HAL.

ptdt.kernel.sim_core

SimCore

C++20

150

Central simulation
orchestrator. Owns the main
simulation loop, module
lifecycle management, frame
pacing, and the inter-module
dependency graph.
Coordinates physics and
render tick sequencing.

ptdt.kernel.scene_graph

SceneGraph

C++20

160

Spatial hierarchy manager.
Maintains the scene DAG
(directed acyclic graph) of
simulation entities. Provides
efficient spatial queries
(AABB, frustum, ray),
transform propagation, and
dirty-flag change tracking.

ptdt.physics

PhysicsEngine

C++20

200

Multi-solver physics cluster:
rigid body, soft body, fluid
(SPH + grid), thermal finitedifference, and quasi-static
EM. Executes on a dedicated
real-time thread pool at a
locked 120 Hz timestep.

ptdt.render

RenderEngine

C++20 /
GLSL

210

GPU rendering pipeline.
Multi-pass deferred renderer
targeting Vulkan 1.3.
Consumes scene state from
the SceneGraph and physics
state from the ring buffer.
Produces the final
composited frame.

ptdt.ui

UIFramework

C++20

220

Retained-mode UI scene
graph, GPU-accelerated 2D
rendering, widget library,
HUD system, layout engine,
input dispatch, and theming.

Module ID

Display Name

Primary
Language

Init
Priority

Description
Feeds the UI Composite Pass
of the render pipeline.

ptdt.backend.bus

BackendBus

C++20 /
Rust

180

Message-broker integration
bus supporting ZeroMQ and
gRPC transports. Handles
data ingestion, telemetry
export, REST API surface, and
Kafka adapter. Enforces
sovereignty egress gating.

ptdt.kernel.asset_mgr

AssetManager

C++20

165

Resource loader and
streaming cache. Manages
raw asset import, LOD pregeneration, streaming cache
eviction (LRU), and runtime
asset hot-reload in
development builds.

ptdt.kernel.event_dispatcher

EventDispatcher

C++20

155

Publish-subscribe event bus.
Supports typed topic
channels, priority queues,
ordered and unordered
delivery, and subscriber
lifetime management. Lockfree on the dispatch hot
path.

ptdt.kernel.state_mgr

StateManager

C++20

158

Deterministic finite state
machine governing
simulation lifecycle. Defines
valid state transitions,
guards, and entry/exit
actions. All transitions are
logged to AuditLogger.

ptdt.security.audit

AuditLogger

Rust 1.78

110

Append-only, tamperevident audit trail. Logs all
state transitions, operator
commands, and backend
transactions. Maintains
Merkle-tree chain for log
integrity. Exports to
sovereign SIEM.

3.4 Inter-Module Dependency Graph
The module dependency graph is a strict DAG (cycles are prohibited and enforced by the registry
loader). Dependencies flow upward from infrastructure to application:

AuditLogger ──────────────────────────────────────────────────────► (no deps)
HAL ──────────────────────────────────────────────────────────────► (no deps)
SimCore ─────────────────────────────────────────────────────────► HAL,
AuditLogger EventDispatcher
─────────────────────────────────────────────────► HAL StateManager
────────────────────────────────────────────────────► EventDispatcher,
AuditLogger SceneGraph
──────────────────────────────────────────────────────► HAL, EventDispatcher
AssetManager ────────────────────────────────────────────────────► HAL,
SceneGraph BackendBus ──────────────────────────────────────────────────────►
HAL, EventDispatcher, AuditLogger PhysicsEngine
───────────────────────────────────────────────────► HAL, SceneGraph,
EventDispatcher RenderEngine
────────────────────────────────────────────────────► HAL, SceneGraph,
AssetManager, PhysicsEngine (read-only) UIFramework
─────────────────────────────────────────────────────► EventDispatcher,
RenderEngine, StateManager

The PhysicsEngine→RenderEngine interface is read-only: the renderer reads physics state from the
shared memory ring buffer but never calls into the physics module at runtime. This eliminates lock
contention and preserves the physics thread's real-time scheduling budget.

3.5 Module Lifecycle
Every module implements the IModule interface, which defines five mandatory lifecycle hooks invoked
by SimCore in strict dependency order:

Phase

Hook

Description

Max
Duration

Initialize

on_init(ModuleContext&)

Allocate resources, register with the module
registry, validate configuration. MUST be
idempotent.

5 000 ms

Warm-Up

on_warmup()

Pre-heat caches, compile shaders, load default
assets, establish IPC channels. May emit progress
events.

30 000
ms

Run

on_tick(TickContext&)

Per-frame execution hook. Called every simulation
tick at the module's registered rate. MUST return
within its time budget.

Budgetdefined

Suspend

on_suspend()

Pause module activity (e.g., operator pause
command). Flush in-flight work; do not release
resources.

100 ms

Teardown

on_teardown()

Release all resources, close IPC channels, flush
AuditLogger, unregister from registry. Called in
reverse dependency order.

2 000 ms

⚠ Lifecycle Constraint
A module that exceeds its
on_init
or
on_warmup
deadline triggers a startup abort with error code
LIFECYCLE-TIMEOUT-001
. A module that exceeds its
on_tick
budget three consecutive frames triggers a watchdog escalation and automatic
LOD downgrade to recover headroom. A module that fails
on_teardown
within its deadline is force-killed by the supervisor and the anomaly is written to the
AuditLogger.

4. Rendering Pipeline
4.1 Pipeline Overview
The PTDT v32 rendering pipeline is a fully custom, multi-pass deferred renderer built on Vulkan 1.3. It is
designed to produce physically accurate, high-fidelity imagery of engineering simulation environments
at 60 fps / 4K with a 16.67 ms frame budget. The pipeline is decomposed into eight sequential passes,
each with a dedicated frame time budget enforced by GPU timestamp queries.
The overall frame execution sequence is:

1. CPU Frame Prepare: Scene visibility determination, draw call batching, constant buffer upload,
command buffer pre-recording for static geometry.

2. GPU Command Recording: Encode all render pass commands into a primary Vulkan command
buffer. Multi-threaded recording using secondary command buffers per render pass.

3. G-Buffer Pass: Deferred geometry encoding — position, normals, albedo, roughness/metallic,
emission written to MRT.

4. Shadow Map Pass: Cascaded shadow map generation for the primary directional light.
5. SSAO Pass: Screen-space ambient occlusion generation and bilateral upscale.
6. Lighting Pass: PBR deferred lighting accumulation using G-Buffer inputs; clustered forward+ for
dynamic lights.

7. Volumetric Pass: Ray-marched atmospheric scattering and volumetric fog accumulation.
8. TAA Pass: Temporal anti-aliasing with velocity buffer reprojection.
9. Post-Processing Pass: Bloom, lens flare, chromatic aberration, HDR tone mapping.
10. UI Composite Pass: 2D HUD overlay, widget rendering, debug layers composited over the 3D
scene.

11. Present: Frame submitted to the Vulkan swapchain; VSync or immediate present depending on
operator configuration.

4.2 Rendering API and Backend Selection
The rendering backend is selected at startup based on the detected GPU driver and target architecture:

Condition

Backend
Selected

Notes

x86_64 + NVIDIA / AMD
GPU with Vulkan 1.3
driver

Vulkan 1.3
(Primary)

Full feature set, all passes enabled. Required extensions:
VK_KHR_dynamic_rendering , VK_EXT_mesh_shader,
VK_KHR_ray_query (optional),
VK_EXT_descriptor_indexing .

ARM64 + Apple Silicon /
Qualcomm with Metal
3.1

Metal 3.1
(Fallback)

Feature parity maintained via Metal compute shaders. SPIR-V
shaders cross-compiled to MSL via spirv-cross.

ARM64 + Mali / Adreno
with Vulkan 1.1+

Vulkan 1.1
(Compatibility)

Reduced feature set: no mesh shaders, ray query disabled. TAA
and volumetric pass quality reduced.

Backend selection is logged to AuditLogger at startup. Operators may override the selected backend via
the render.backend configuration key for testing purposes; overrides are flagged in the audit trail.

4.3 Multi-Pass Architecture
4.3.1 G-Buffer Pass
The G-Buffer encodes all geometric surface properties needed for deferred lighting into six render
targets bound as a Multiple Render Target (MRT) attachment group:

G-Buffer Slot

Format

Contents

VRAM
Cost (4K)

RT0 — Albedo/AO

R8G8B8A8_UNORM

Base color (RGB), ambient occlusion (A)

31.6 MB

RT1 — Normal

R16G16_SFLOAT

Octahedron-encoded world-space normal

31.6 MB

RT2 — PBR
Material

R8G8B8A8_UNORM

Roughness (R), Metallic (G), Emissive mask (B),
ShadingID (A)

31.6 MB

RT3 — Emission

R11G11B10_UFLOAT

HDR emissive radiance

23.7 MB

RT4 — Velocity

R16G16_SFLOAT

Screen-space motion vectors for TAA reprojection

31.6 MB

Depth

D32_SFLOAT_S8_UINT

32-bit depth + 8-bit stencil

39.5 MB

4.3.2 Shadow Map Pass
Cascaded Shadow Maps (CSM) with 4 cascades are generated for the primary directional light (solar or
overhead industrial lamp model). Each cascade is rendered to a 4096×4096 D32_SFLOAT depth
attachment. Cascade split distances are computed using a logarithmic/uniform blend with a userconfigurable lambda parameter (default: 0.75). PCF (Percentage-Closer Filtering) with a 3×3 Poisson disk
kernel is applied during the lighting pass shadow sampling.
// CSM split computation (tri_state::ptdt::v32::render::CSMSplitter) float
split_lambda = config.csm_split_lambda; // default 0.75 for (int i = 0; i <
NUM_CASCADES; ++i) {
float p
= (i + 1.0f) / NUM_CASCADES;
float log_split = near * std::pow(far / near, p);
float uni_split = near
+ (far - near) * p;
splits[i] = split_lambda * log_split + (1.0f split_lambda) * uni_split; }

4.3.3 SSAO Pass
Screen-Space Ambient Occlusion (SSAO) is computed at half-resolution (1920×1080 for a 4K target)
using 32 hemisphere-distributed samples per pixel, a 64-texel noise tile for sample rotation, and a 0.5-

meter sampling radius. The half-resolution result is upscaled using a depth-aware bilateral filter to
suppress discontinuities at depth edges.

4.3.4 Lighting Pass
The lighting pass reconstructs world-space position from the depth buffer and G-Buffer inputs, then
evaluates the GGX-Smith PBR BRDF for all light contributions:

● Directional light: Single CSM-shadowed directional light (sun/overhead).
● Image-Based Lighting (IBL): Pre-filtered environment map (256×256 cubemap, 8 mip levels) +
BRDF LUT for ambient specular. Environment maps are loaded per-scenario from the
AssetManager.

● Dynamic lights (clustered forward+): Screen-space 3D cluster grid (32×18×64 clusters at 4K). Up
to 1,024 dynamic point and spot lights per scene; per-cluster light list built via GPU compute
shader each frame.

4.3.5 Volumetric Pass
A ray-marched volumetric pass computes atmospheric scattering and fog density using a 160×90×64
voxel froxel (frustum-aligned voxel) grid. Sixteen ray-march steps per froxel are used in production
quality; eight steps in performance mode. Phase function: Henyey-Greenstein with configurable
anisotropy (default g=0.4).

4.3.6 TAA Pass
Temporal Anti-Aliasing (TAA) accumulates history across 8 frames. Sub-pixel jitter patterns follow the
Halton(2,3) sequence, 16-sample cyclic. Reprojection uses the velocity buffer (RT4) for dynamic objects
and camera matrix delta for static geometry. History validation rejects samples with color variance >20%
or depth discontinuity >0.01 NDC to prevent ghosting.

4.3.7 Post-Processing Pass
Executed as a sequence of full-screen compute shader dispatches in a single Vulkan render pass:

● Bloom: Dual-threshold (0.8 exposure units) 5-pass downsample + 5-pass upsample Kawase
filter; additive blend over HDR buffer.

● Lens Flare: Screen-space lens flare computed from bright-pixel positions; 4 flare elements with
configurable starburst pattern.

● Chromatic Aberration: Radial RGB channel offset (max ±2 px at corners); disabled in
engineering/measurement modes.

● HDR Tone Mapping: ACES filmic tone curve (Hill approximation) mapping scene HDR (0–20 EV)
to display SDR (sRGB). Configurable exposure (auto-exposure via luminance histogram or
manual EV override).

4.3.8 UI Composite Pass
The UI Composite Pass renders the UIFramework's 2D scene graph over the tonemapped 3D scene using
pre-multiplied alpha blending. HUD elements, widget overlays, and debug layers are composited in
defined z-order layers (0–255). GPU-accelerated 2D vector rendering uses a signed distance field (SDF)
font atlas for crisp text at all scales.

4.4 Frame Budget
Target: 60 fps at 3840×2160 (4K) → 16.67 ms total frame budget on reference hardware (NVIDIA RTX
4090 / AMD RX 7900 XTX or equivalent). Budgets are measured by GPU timestamp queries inserted at
pass boundaries.

Pass

GPU
Budget
(ms)

CPU Prep
Budget
(ms)

Notes

Scene Prepare / Culling (CPU)

—

1.50

Frustum cull, draw call sort, CB upload

G-Buffer Pass

3.50

0.30

Primary geometry draw cost

Shadow Map Pass

2.00

0.20

4× 4096² cascades

SSAO Pass

0.80

0.05

Half-res + bilateral upscale

Lighting Pass

2.50

0.10

Includes cluster build + IBL

Volumetric Pass

1.20

0.05

Froxel injection + ray march

TAA Pass

0.60

0.05

Reprojection + history blend

Post-Processing Pass

1.20

0.05

Bloom + tone map + LDR encode

UI Composite Pass

0.80

0.20

2D widget render + HUD overlay

Present + Driver Overhead

0.80

—

Swapchain present, driver flush

Total

13.40

2.50

Headroom: ~0.77 ms GPU

★ Budget Enforcement Policy
If any pass exceeds its GPU budget for three consecutive frames (measured by
timestamp deltas), the watchdog triggers an automatic
Quality Tier Downgrade
: SSAO samples reduce from 32→16, cascade resolution reduces 4096→2048,
volumetric ray steps reduce 16→8. The downgrade is logged and operator-visible
via the HUD performance overlay.

4.5 Level-of-Detail System
The PTDT v32 LOD system uses a screen-space error metric to select geometric detail levels dynamically.
Each asset is authored with up to 5 LOD levels (LOD0–LOD4). The LOD selector runs on the CPU during
scene preparation each frame:
// LOD selection formula float screen_error = (mesh.world_radius /
distance_to_camera)
* (viewport_height / tan(fov_y *
0.5f)); // LOD thresholds (configurable, pixels) // LOD0: screen_error > 120
px // LOD1: 60 < screen_error ≤ 120 px // LOD2: 25 < screen_error ≤ 60 px //
LOD3: 10 < screen_error ≤ 25 px // LOD4: screen_error ≤ 10 px

LOD transitions are blended using dithered cross-fading over 0.25 seconds to suppress popping artifacts.
Impostor billboards replace geometry below LOD4 threshold for extreme distances.

4.6 Culling System
Three culling stages eliminate non-visible geometry before GPU submission:

12. Frustum Culling: AABB vs. frustum plane tests for all scene entities. Executed on the main CPU
thread using SIMD (AVX2) for 8 entities per cycle. Typically eliminates 40–65% of draw calls in
large scenes.

13. Hierarchical Z-Buffer (HZB) Occlusion Culling: A 12-level mip-chain HZB is built from the
previous frame's depth buffer via GPU compute. Entity AABBs are projected and tested against
the HZB on the GPU each frame, producing an occlusion bitmask read back to the CPU. Typically
eliminates an additional 20–35% of draw calls in dense environments.

14. Distance Culling: Entities beyond the configured maximum draw distance
(render.max_draw_distance, default 2000 m) are unconditionally culled. Configurable perasset type (e.g., vegetation 500 m, structural elements 2000 m).

4.7 Shader Management
All shaders are authored in GLSL 4.60 (primary) or HLSL SM 6.6 (for engineer familiarity) and compiled
offline to SPIR-V using glslangValidator / dxc as part of the build pipeline. SPIR-V binaries are
stored in the shader cache at /opt/ptdt/cache/shaders/ alongside their source SHA-256 hash for
cache invalidation.
In development builds, a shader hot-reload watcher monitors source files and recompiles + reloads
modified shaders within one frame, enabling iterative shader development without restarting the
simulator. In production builds, hot-reload is disabled; only pre-compiled, signed SPIR-V from the build
pipeline is accepted.

4.8 GPU Memory Management
All GPU allocations are managed through Vulkan Memory Allocator (VMA) 3.1.0. The VMA is configured
with three memory pools:

Pool

Heap Type

Budget

Contents

Static
Geometry Pool

DEVICE_LOCAL

8 GB

Vertex/index buffers for static scene geometry; loaded at
scenario start, evicted at scenario end.

Dynamic
Frame Pool

DEVICE_LOCAL

2 GB

Per-frame constant buffers, dynamic mesh data, physics
debug geometry. Ring-buffered ×3 for triple-buffering.

Texture /
Image Pool

DEVICE_LOCAL

12 GB

All scene textures (albedo, normal, material), shadow maps,
G-Buffer RTs, environment cubemaps. Managed with
streaming eviction.

Staging Pool

HOST_VISIBLE |
HOST_COHERENT

2 GB

CPU→GPU upload staging. Persistently mapped. Used by
AssetManager for texture streaming.

VMA defragmentation is run during scene transitions (not during active simulation) to consolidate
fragmented allocations. Budget overruns trigger an alert to the operator HUD and initiate streaming
cache eviction of lowest-priority assets.

4.9 GPU Profiling Hooks

The renderer inserts Vulkan timestamp queries at every pass boundary and exposes the following
profiling interfaces:

● Per-Pass GPU Timestamps: Pass begin/end timestamps queried from
VK_QUERY_TYPE_TIMESTAMP; results readable within 2 frames. Exposed via the performance

overlay HUD widget.

● Pipeline Statistics: VK_QUERY_TYPE_PIPELINE_STATISTICS captures per-pass: vertex
shader invocations, fragment shader invocations, compute shader invocations, clipping
primitives. Available in dev builds only.

● Debug Labels: All render passes, compute dispatches, and resource barriers are annotated with
vkCmdBeginDebugUtilsLabelEXT labels for GPU debugger (RenderDoc, NVIDIA Nsight)

compatibility.

● Performance Overlay: A HUD-integrated real-time performance graph displays frame time, perpass GPU time, CPU prep time, VRAM usage, and draw call count as live time-series charts.

5. Physics Models
5.1 Physics Solver Architecture
The PhysicsEngine module executes on a dedicated, PREEMPT_RT-scheduled thread pool isolated from
the rendering and UI threads. The solver operates at a fixed 120 Hz timestep (Δt = 8.333 ms). Simulation
results are written to the shared memory ring buffer at 120 Hz; the renderer interpolates between the
two most recent physics states for display at 60 Hz, providing smooth visual motion without substepping the render loop.
// Physics main loop (simplified, tri_state::ptdt::v32::physics::Scheduler)
while (running_) {
auto tick_start = hires_clock::now();
integrate_rigid_bodies(dt_fixed_);
// 120 Hz
solve_constraints(dt_fixed_);
// 120 Hz
step_fluid_simulation(dt_fixed_);
// 120 Hz (SPH) / 30 Hz (grid)
step_thermal_solver(dt_fixed_);
// 60 Hz (FD grid)
step_em_solver(dt_fixed_);
// 10 Hz (quasi-static)
write_state_to_ring_buffer(current_seq_++); // atomic publish
auto
elapsed = hires_clock::now() - tick_start;
if (elapsed < tick_period_) {
sleep_until(tick_start + tick_period_); // deterministic pacing
} else {
emit_overrun_event(elapsed, tick_period_);
} }

5.2 Rigid Body Dynamics
Rigid body integration uses velocity Verlet (semi-implicit Euler for rotational components), chosen for its
symplectic properties that conserve energy over long simulations:
// Velocity Verlet integration kernel v_new = v + (f/m) * dt; x_new = x +
v_new * dt; // Angular: omega_new = omega + I_inv * (tau - omega.cross(I *
omega)) * dt; q_new
= normalize(q + 0.5f * Quaternion(0, omega_new) * q *
dt);

Broad-phase collision detection uses an AABB tree (dynamic BVH) with incremental update — entity
AABBs are updated in place each tick; tree rebalancing occurs only when the tree quality metric falls
below threshold. Broad-phase outputs overlapping pairs for narrow-phase processing.
Narrow-phase collision detection uses the GJK (Gilbert-Johnson-Keerthi) algorithm for closest-point
queries between convex shapes, with EPA (Expanding Polytope Algorithm) for penetration depth and
contact normal computation. Contact manifolds support up to 4 contact points per pair, persisted across
frames for stability.

5.3 Soft Body Simulation
Soft body simulation uses Position-Based Dynamics (PBD) for real-time performance. The PBD solver
iterates over a set of geometric constraints (distance, bending, volume preservation) applied to a
particle mesh:

Constraint Type

Description

Default
Iterations

Stiffness
Range

Distance

Maintains rest edge length between particle pairs

8

0.1–1.0

Bending

Dihedral angle constraint between adjacent triangle
pairs

4

0.01–0.5

Volume

Conserves enclosed volume for inflated bodies

2

0.8–1.0

Shape Matching

Elastic goal-shape constraint for semi-rigid
deformation

4

0.1–0.95

Collision Contact

Positional correction for surface collision response

Per contact

1.0 (hard)

Substep count is configurable per material (default 4 substeps within the 120 Hz tick). XPBD (eXtended
PBD) formulation is used for compliance-parameterized constraints, decoupling stiffness from iteration
count.

5.4 Fluid Simulation

The fluid subsystem provides two solvers selected based on scenario configuration and fluid volume:

5.4.1 SPH (Smoothed-Particle Hydrodynamics)
Used for localized fluid effects (spills, cooling fluid jets, contained liquid volumes up to ~50,000
particles). SPH evaluates density, pressure, and viscosity forces using a cubic spline kernel with support
radius h=0.05 m (configurable). Particle neighbor searches use a uniform spatial hash grid rebuilt each
tick.
// SPH density estimation kernel ρ_i = Σ_j m_j * W(|x_i - x_j|, h) //
Pressure from equation of state (Tait EOS): p_i = k * (ρ_i/ρ_0 - 1)
// k =
stiffness, ρ_0 = rest density

5.4.2 Grid-Based Pressure Solver
For large-volume fluid simulations (tanks, reservoirs, atmospheric regions), a MAC (Marker-and-Cell) grid
solver on a uniform Cartesian grid is used. The pressure Poisson equation is solved via a preconditioned
conjugate gradient (PCG) solver with an incomplete Cholesky preconditioner. Grid resolution is
configurable (default 128×128×64 cells per simulation domain).

5.5 Thermal Physics Model
Thermal simulation uses a finite-difference heat diffusion model on a 3D Cartesian grid aligned with the
scene's axis-aligned bounding box. The explicit forward-difference update (with adaptive timestep for
stability) computes:
// Finite-difference heat equation (3D, uniform grid) ∂T/∂t = α * ∇²T +
Q_source // Discretized update at cell (i,j,k): T_new[i][j][k] = T[i][j][k]
+ α * dt_thermal * (
(T[i+1][j][k] - 2*T[i][j][k] + T[i-1][j][k]) /
dx²
+ (T[i][j+1][k] - 2*T[i][j][k] + T[i][j-1][k]) / dy²
+
(T[i][j][k+1] - 2*T[i][j][k] + T[i][j][k-1]) / dz²
) + Q_source[i][j][k]
* dt_thermal;

Thermal diffusivity α = k/(ρ·c_p) is computed per-cell from the material property database (§5.8).
Boundary conditions support: fixed temperature (Dirichlet), insulated surface (Neumann), and
convective exchange (Robin). Grid resolution is configurable (default 64³ cells); thermal updates run at
60 Hz sub-sampled from the 120 Hz physics tick.

5.6 Electromagnetic Field Model
A quasi-static EM solver is provided for sensor simulation scenarios (e.g., eddy current NDT simulation,
capacitive sensor modeling, inductive proximity sensing). The solver computes the static electric
potential φ and magnetic vector potential A on a 3D FEM (Finite Element Method) tetrahedral mesh
using a direct sparse LU decomposition (via Eigen's SparseLU). The quasi-static assumption (∂B/∂t ≈ 0 for

low-frequency sensor fields) is valid for excitation frequencies below 10 MHz as used in engineering NDT
contexts.
EM solve frequency is 10 Hz (every 12 physics ticks), sufficient for simulating slowly varying sensor fields.
Results are exported to the BackendBus as EMFieldSnapshot Protobuf messages for external sensor
emulation consumers.

5.7 Constraint System
The constraint solver uses a Sequential Impulse (SI) / Projected Gauss-Seidel method, iterating over all
constraints for a configurable number of solver iterations (default: 8 velocity iterations, 4 position
correction iterations per tick).

Constraint Type

Class

DOF Removed

Typical Use

Fixed Joint

Bilateral

6

Rigid weld between bodies

Hinge Joint

Bilateral

5

Door hinges, shaft bearings

Prismatic Joint

Bilateral

5

Linear actuators, slides

Ball-and-Socket

Bilateral

3

Universal joints, spherical bearings

Motor (angular)

Bilateral + drive

—

Servo motors, drive shafts

Contact Normal

Unilateral

1 (ineq.)

Rigid body surface contact

Friction

Unilateral cone

2 (cone)

Coulomb friction at contacts

Limit Stop

Unilateral

1 (ineq.)

Joint range-of-motion limits

5.8 Material Property Database
Material properties are defined in the platform's material database
(data/materials/engineering_materials.json) and loaded at startup by the PhysicsEngine.
Key properties for common engineering materials:

Material

Density
(kg/m³)

Young's Modulus
(GPa)

Poisson's
Ratio

Static
Friction
µ_s

Dynamic
Friction
µ_k

Thermal
Conductivity
(W/m·K)

Structural Steel (A36)

7 850

200

0.30

0.74

0.57

50.2

Aluminum 6061-T6

2 700

69

0.33

0.61

0.47

167

Carbon Fiber (CFRP)

1 600

70 (trans.) / 230
(long.)

0.28

0.45

0.38

5.0 (trans.) / 50
(long.)

Material

Density
(kg/m³)

Young's Modulus
(GPa)

Poisson's
Ratio

Static
Friction
µ_s

Dynamic
Friction
µ_k

Thermal
Conductivity
(W/m·K)

Concrete (C30)

2 400

30

0.20

0.80

0.65

1.65

HDPE (High-Density
Polyethylene)

960

0.7

0.46

0.30

0.22

0.44

Titanium Ti-6Al-4V

4 430

114

0.34

0.60

0.42

6.7

Borosilicate Glass

2 230

64

0.20

0.90

0.40

1.14

Natural Rubber

920

0.005

0.499

0.70

0.55

0.16

5.9 Determinism Guarantees
The PhysicsEngine provides bit-exact reproducibility guarantees under the following conditions:

15. IEEE 754 Strict Mode: All physics computations use -ffloat-store, -fno-unsafe-mathoptimizations, and -mfpmath=sse (x86_64). 80-bit x87 extended precision is disabled.

Denormal handling: flush-to-zero (FTZ) and denormals-are-zero (DAZ) are disabled in physics
threads to preserve IEEE 754 semantics.

16. Fixed-Seed RNG: All randomness in the physics solver (e.g., noise perturbations, Monte Carlo
sampling in SPH) uses a deterministic Xoshiro256++ generator seeded from the scenario
manifest's rng_seed field.

17. Ordered Multi-threading: Thread pool tasks that contribute to physics state are executed in a
deterministic order enforced by the task graph dependency scheduler. No physics output
depends on thread scheduling order.

18. Platform Constraints: Determinism is guaranteed only within the same instruction set
architecture (x86_64 ↔ x86_64, or ARM64 ↔ ARM64). Cross-architecture determinism is not
guaranteed due to SIMD differences; this is a documented limitation tracked in issue TSE-PTDTDET-001.

5.10 Multi-Threading Model
The PhysicsEngine's internal job system maintains a 16-thread worker pool, with 2 threads designated
as high-priority real-time threads pinned to isolated CPU cores (via pthread_setaffinity_np). The
task graph is a DAG of PhysicsTask objects with explicit data dependencies:

// Task graph for a single physics tick (simplified) [BVH_UPDATE] →
[BROADPHASE] → [NARROWPHASE] → [CONSTRAINT_SETUP]
↓ [SPH_NEIGHBORS] → [SPH_FORCES] → [SPH_INTEGRATE] [CONSTRAINT_SOLVE (x8)]
↓ [THERMAL_UPDATE (60 Hz gate)]
[RIGID_INTEGRATE]
↓
←────────── [RING_BUFFER_WRITE]

Tasks are enqueued to the job system and scheduled using a work-stealing queue. The ring buffer write
is the final synchronization point; it is executed on the primary physics thread after all dependent tasks
complete.

6. UI System
6.1 UI Framework Architecture
The UIFramework is a retained-mode scene graph-based UI system with GPU-accelerated 2D rendering.
It is architecturally decoupled from the 3D render pipeline and communicates exclusively through the
EventDispatcher (for state changes) and the UI Composite Pass (for pixel output). The framework owns
its own 2D command buffer and submits it each frame to the RenderEngine's composite pass.
The UI scene graph is a tree of Widget nodes. Layout is computed in a single-pass bottom-up measure /
top-down arrange cycle triggered by the layout dirty flag. The dirty flag propagates upward when any
widget property changes, ensuring only affected subtrees are re-laid out.

6.2 Widget Library
Widget Class

Namespace

Description

Panel

ui::widgets

Rectangular container with configurable border, background fill, and
clip region. Foundation for all compound widgets.

Button

ui::widgets

Pressable button with label, icon slot, configurable
press/hover/disabled states, keyboard activation.

Slider

ui::widgets

Continuous value input; horizontal/vertical orientation; configurable
min/max/step; live value readout label.

Toggle

ui::widgets

Boolean on/off toggle with animated state transition. Supports tri-state
(on/off/indeterminate) for group selections.

DataTable

ui::widgets

Virtualized scrollable table with sortable columns, configurable row
height, highlighted rows, and live cell update support for highfrequency telemetry.

Widget Class

Namespace

Description

ViewportOverlay

ui::widgets

3D viewport overlay widget; projects world-space annotation points to
screen-space for label, arrow, and callout rendering anchored to 3D
objects.

TimeSeriesChart

ui::widgets

GPU-accelerated time-series line chart; up to 16 simultaneous series;
configurable scroll window (1s–3600s); real-time updates at up to 1
kHz.

AlertBanner

ui::widgets

Priority-ordered alert notification strip; auto-dismiss configurable;
severity levels: INFO, WARNING, ERROR, CRITICAL with corresponding
visual treatment.

ProgressBar

ui::widgets

Determinate and indeterminate progress indicators; used for asset
loading, snapshot operations, and warm-up phases.

TextField

ui::widgets

Single-line and multi-line text input; IME support via ICU; pastesanitization to prevent injection via operator input.

ComboBox

ui::widgets

Drop-down selection widget with searchable list, keyboard navigation,
and virtualized item rendering for large option sets.

ColorSwatch

ui::widgets

Material / temperature visualization swatch; displays scalar-to-color
mapping (heatmap gradient) for physics field overlays.

6.3 HUD System
The Heads-Up Display (HUD) is a configurable overlay rendered by the UIFramework. It is composed of a
set of HUD zones, each docked to a defined screen region and populated by HUD modules:

HUD Zone

Default Dock
Position

Contents

Status Bar

Top-center

Simulation state badge, current scenario name, session ID, operator
name

Simulation Clock

Top-right

Simulation elapsed time (HH:MM:SS.mmm), real-time factor indicator,
physics tick counter

Telemetry Panel

Right-side dock

Configurable live telemetry readouts; up to 32 user-selected channels
displayed as numeric values or mini time-series charts

Alert Queue

Bottom-center

Prioritized alert banners; up to 5 simultaneously visible; scroll
indicator if more queued

Performance
Overlay

Bottom-left

Frame time, GPU time per pass, CPU time, draw calls, VRAM usage;
toggle via F10

Mini-Map

Bottom-right

Top-down orthographic mini-map with entity position indicators;
optional, operator-toggleable

Notification
Stack

Top-right (below
clock)

Toast notifications for system events (snapshot saved, module hotreloaded, etc.)

HUD layout is persisted per-operator in their user profile and survives across sessions. The HUD editor
(accessible via Ctrl+Shift+H) provides a drag-and-drop interface for repositioning and resizing HUD
zones.

6.4 Layout Engine
The layout engine implements a constraint-based solver inspired by flexbox semantics but implemented
natively without CSS or web technology dependencies. Layout is computed in a two-phase bottomup/top-down pass:

19. Measure Phase (bottom-up): Each widget reports its desired size based on its content and
minimum size constraints. Parent widgets aggregate children's desired sizes.

20. Arrange Phase (top-down): Each parent widget allocates a bounding rect to each child based on
available space, alignment, flex grow/shrink ratios, and explicit size overrides.
Layout computation runs on the main thread and is bounded to complete within 0.5 ms per frame for
the expected maximum widget tree depth (200 nodes).

6.5 Input Handling
The input subsystem normalizes input events from all supported input devices into a unified
InputEvent type dispatched via the EventDispatcher:

Device

Supported Events

Notes

Keyboard

KeyDown, KeyUp, KeyRepeat, TextInput

Full QWERTY + numpad; configurable key
bindings per operator role

Mouse

ButtonDown, ButtonUp, Move, Wheel, Drag

Raw input mode for 3D viewport; GUI mode
for widget interaction

Gamepad

ButtonDown, ButtonUp, AxisChanged,
Rumble

XInput and HID profiles; configurable axis
dead zones

Touch (Tablet)

TouchDown, TouchUp, TouchMove, Pinch,
Pan

For ARM64 field tablet deployments; multitouch up to 10 points

Stylus (Active)

StylusDown, StylusUp, StylusMove,
PressureChanged, TiltChanged

Wacom and N-trig; pressure and tilt used for
annotation tools

6.6 Theming System

The theming system provides a CSS-like property inheritance model. Theme properties are defined in
theme descriptor files (themes/dark_sovereign.theme.json,
themes/light_engineering.theme.json) and applied at widget creation. Child widgets inherit

unset properties from their parent, enabling consistent styling with minimal per-widget configuration.
The Sovereign Dark theme (default) uses the following brand palette:

Role

Hex Color

Usage

Background Primary

#0d1b2a

Main panel backgrounds, HUD zones

Background Secondary

#1b2f47

Widget backgrounds, list items

Accent Primary

#2a7fff

Active selections, focus rings, primary buttons

Accent Secondary

#00c4a7

Status indicators, success states, telemetry values

Text Primary

#e8eef4

Primary labels, values, headings

Text Secondary

#8aa4bf

Secondary labels, units, timestamps

Warning

#f5a623

Warning alerts, thresholds exceeded

Error / Critical

#e74c3c

Critical alerts, fault indicators, stop states

Border

#2a4a6a

Panel borders, separators, table gridlines

6.7 Localization
The UIFramework uses ICU 74.2 for all locale-sensitive operations. String resources are stored in CLDRformatted JSON bundles at resources/l10n/{locale_code}/ui.json. Supported locales at
launch: en-US, de-DE, fr-FR, ja-JP, ar-SA (RTL). All internal strings are UTF-8; ICU handles
bidirectional text reordering and shaping. Number formatting, unit suffixes, and date/time display
respect the active locale's conventions. Locale selection is an operator-profile setting.

6.8 Accessibility
The UIFramework targets WCAG 2.1 Level AA compliance for operator-facing interfaces. Implemented
measures include:

● Keyboard Navigation: Full tab-order traversal of all interactive widgets; no interaction requires
a mouse exclusively.

● Focus Indicators: High-contrast focus rings (3 px, accent color) on all focused interactive
elements.

● Color Contrast: All text/background pairings meet minimum 4.5:1 contrast ratio (WCAG AA)
verified by the theming system's contrast checker at theme load time.

● Screen Reader Hooks: All widgets expose accessible name, role, and state via the platform's
accessibility API abstraction (ui::a11y::AccessibleNode), compatible with AT-SPI2 on
Linux.

● Text Scale: UI layout respects system font scaling preferences; tested at 100%, 125%, 150%, and
200% scale factors.

6.9 Developer Tooling
In development builds, the UIFramework activates additional diagnostic tools accessible via the
developer overlay (F9 toggle):

● Widget Inspector: Click any widget to inspect its properties, computed layout rect, style
properties, and event subscriptions in a floating inspector panel.

● Layout Debugger: Overlays colored bounding rectangles for all widget bounds and
margin/padding regions.

● Input Event Log: Real-time log of all input events with timestamps, coordinates, and dispatch
path.

● Theme Editor: Live property editor for theme colors and sizes with immediate visual feedback;
changes are not persisted unless explicitly exported.

● Performance Overlay: UI-specific metrics: layout time, draw call count, glyph atlas utilization,
event queue depth.

6.10 State Binding
Widgets support reactive data binding via a type-safe observable property system. Simulation state
variables exported by the StateManager and PhysicsEngine are wrapped in Observable<T> handles.
Widgets bind to observables and are automatically invalidated and re-rendered when the observed
value changes:
// Example: bind a telemetry readout label to a physics state variable auto
pressure_obs = sim_state.get_observable<float>("fluid.tank1.pressure_kpa");
auto* label = new ui::widgets::TextLabel(); label->bind_text(pressure_obs,

[](float v) {
return std::format("{:.2f} kPa", v); });
hud.telemetry_panel->add_child(label);

Bindings are evaluated on the UI thread at frame rate; high-frequency observables (>100 Hz) are
automatically downsampled to 60 Hz for UI consumption to prevent widget thrashing.

7. Backend Integration
7.1 Integration Bus Architecture
The BackendBus module implements a message-broker pattern providing a unified integration surface
between the simulator and external systems within the sovereign enclave. The transport layer is
operator-selectable between ZeroMQ 4.3.5 and gRPC 1.64 at deployment time, configured via
backend.transport in the platform configuration file.

Transport

Protocol

Max
Throughput

Latency

Best For

ZeroMQ
(ZMQ)

TCP/IPC over
ZMTP 3.0

~800 MB/s
intra-enclave

~50 µs

High-throughput sensor ingest; telemetry
streaming; pub-sub fan-out

gRPC

HTTP/2 over
TLS 1.3

~200 MB/s

~500 µs

Request-response control API; authenticated
service mesh; structured schema enforcement

The BackendBus exposes a single abstract IBusTransport interface to all internal consumers;
transport selection is transparent to consuming modules. Both transports use Protobuf-encoded
messages (§7.7) as the wire format.

7.2 Data Ingestion
The ingest subsystem supports the following data feed types:

Feed
Type

Adapter Class

Format

Max Rate

Description

RealTime
Sensor
Feed

SensorFeedAdapter

Protobuf /
binary packed
float arrays

1 kHz per
channel

Live hardware sensor data injected
into physics solver as boundary
conditions or state overrides

Feed
Type

Adapter Class

Format

Max Rate

Description

CSV File

CsvIngestAdapter

RFC 4180 CSV
with header
row

Batch at load

Historical data import; scenario
initialization datasets; material
property tables

JSON
Feed

JsonIngestAdapter

JSON Lines
(NDJSON)

10 Hz

Structured configuration updates,
annotation data, scene patch
messages

Protobuf
Stream

ProtoStreamAdapter

Lengthprefixed
Protobuf
messages

1 kHz

Primary format for platform-native
data exchange; schema-validated

Replay
File

ReplayFileAdapter

PTDT
Snapshot
Archive (.ptsa)

Batch/streaming

Deterministic replay from a
previously captured simulation
snapshot

7.3 Telemetry Export
The telemetry subsystem exports time-series metrics from the simulation to sovereign time-series
databases within the enclave:

● InfluxDB 2.7: Primary telemetry sink. Simulation metrics are written via the InfluxDB Line
Protocol at a configurable sampling rate (1 Hz to 1 kHz per-metric granularity). Metric
namespacing: ptdt.v32.{module}.{metric_name}. Retention policy: 90 days hot, 1 year
cold (operator-configurable).

● Prometheus Exporter: Exposes an HTTP scrape endpoint (/metrics) on the internal VLAN for
Prometheus scraping. Gauge, counter, and histogram types supported. Default scrape interval:
15 s.

● Custom Callbacks: Modules may register ITelemetrySubscriber callbacks for real-time inprocess telemetry consumption (e.g., UIFramework's time-series chart widgets receive
telemetry via this path at display refresh rate, bypassing the network stack).

7.4 REST API Surface
The BackendBus exposes a REST API on the internal VLAN for operator portal and automation
integration. The API is versioned under the path prefix /api/v1/. All endpoints require authenticated
requests (§7.5).

Endpoint

Method

Description

/api/v1/simulation/start

POST

Start simulation. Body: {"scenario_id": string,
"rng_seed": int}. Returns session token.

/api/v1/simulation/stop

POST

Graceful simulation shutdown. Triggers teardown sequence.

/api/v1/simulation/pause

POST

Pause simulation (physics frozen; UI and telemetry remain
active).

/api/v1/simulation/resume

POST

Resume from paused state.

/api/v1/simulation/reset

POST

Reset to initial scenario state. Optionally specify checkpoint
ID.

/api/v1/simulation/snapshot

POST

Trigger immediate state snapshot. Returns snapshot ID and
URI.

/api/v1/simulation/status

GET

Returns current simulation state, tick counter, real-time
factor, active scenario.

/api/v1/scene/config

GET /
PUT

Get or update scene configuration parameters (lighting,
gravity, material overrides).

/api/v1/assets/upload

POST

Upload a new asset (multipart/form-data). Asset is imported,
processed, and added to the asset registry. Requires Engineer
role.

/api/v1/scenarios

GET

List all available scenarios with metadata.

/api/v1/scenarios/{id}

GET /
PUT /
DELETE

Retrieve, update, or delete a specific scenario manifest.

/api/v1/telemetry/channels

GET

List available telemetry channels with sampling rates and data
types.

/api/v1/audit/log

GET

Query audit log entries (paginated). Requires Auditor role.

7.5 Authentication and Authorization
The BackendBus enforces authentication and authorization on all API endpoints and bus connections:

● Service-to-Service (mTLS): All internal service mesh connections use mutual TLS 1.3 with
certificates issued by the sovereign Certificate Authority (CA) managed by the key management
system (§9.5). Certificate rotation: 90-day validity, automated renewal via the platform's
internal ACME-like protocol.

● Operator Portal (OAuth 2.0 / OIDC): Human operators authenticate via an OIDC-compliant
identity provider running within the sovereign enclave. Access tokens are short-lived JWTs (15minute expiry); refresh tokens are stored in the platform's session manager with 8-hour lifetime.

● API Key (Automation): Automation clients (CI/CD pipelines, test harnesses) may use static
HMAC-SHA256 API keys issued by the Admin role. Keys are stored hashed in the platform's
credential store and must be rotated every 180 days.

7.6 Data Sovereignty Controls

■ Sovereign Restriction — Data Egress
All data paths within the PTDT v32 platform MUST remain within the sovereign
enclave boundary. No simulation state, telemetry, asset, or log data may be
transmitted to endpoints outside the operator-designated internal VLAN without
explicit operator approval logged in the AuditLogger. Egress attempts that bypass
this control are treated as a Critical security incident (incident code
SOV-EGR-001
).

Sovereignty controls are enforced at two layers:

21. Application Layer: The BackendBus maintains an allowlist of approved internal endpoint
addresses. Connections to addresses outside this allowlist are rejected with error
EGRESS_BLOCKED and logged.

22. OS/Network Layer: Host OS firewall rules (iptables/nftables) enforce an explicit deny-all-egress
policy. The firewall configuration is managed by the platform's boot-time configuration agent
and verified by the startup pre-flight audit.

7.7 Schema Registry
All platform messages are defined using Protocol Buffers 3 (proto3) schemas managed in the platform's
internal Schema Registry. The registry enforces backward-compatible evolution rules:

● Fields may be added with new field numbers; existing field numbers are immutable.

● Field types may not be changed in a backward-incompatible way without incrementing the
message major version.

● Deprecated fields are marked with the deprecated = true option and retained for 2 major
versions before removal.

● Schema versions are tracked in the SchemaVersion header field included in all message
envelopes.
// Example message envelope (ptdt/common/envelope.proto) syntax = "proto3";
package tri_state.ptdt.v32.common; message MessageEnvelope {
string
schema_version = 1; // "v1.2.0"
string source_module
= 2; //
"ptdt.physics"
int64
timestamp_ns
= 3; // Unix epoch nanoseconds
string session_id
= 4; // Active simulation session UUID
bytes
payload
= 5; // Serialized inner message
bytes
hmac_sha256
= 6; // Message authentication code }

7.8 Event Streaming
For high-throughput event pipelines (e.g., streaming simulation events to an analytics backend within
the enclave), the BackendBus provides an Apache Kafka 3.7 adapter. Kafka operates within the
sovereign enclave; the broker cluster must be deployed on dedicated internal infrastructure. Topics and
partition keys follow the naming convention ptdt.v32.{module}.{event_type}. Maximum
sustained publish rate: 500k events/sec at average message size of 256 bytes.

7.9 Audit Trail
Every backend API call, bus message publish, and authentication event is written to the AuditLogger
(§3.3) with the following metadata: timestamp (nanosecond resolution), calling operator / service
identity, operation type, affected resource, request parameters (sanitized), result code, and platformkey HMAC-SHA256 signature. The audit trail is append-only; no deletion or modification API exists. Audit
log integrity is verified by the Merkle-tree chain maintained by AuditLogger.

8. Operational Workflows
8.1 Simulation Lifecycle Workflow
The simulation lifecycle is governed by the StateManager's deterministic finite state machine. The
defined states and transitions are:

[OFFLINE]
│ operator: start_platform()
▼ [INITIALIZING] ────
init_timeout ──► [FAULT]
│ all modules on_init() complete
▼
[WARMING_UP] ──── warmup_timeout ──► [FAULT]
│ all modules on_warmup()
complete; pre-flight checks pass
▼ [READY]
│ operator:
load_scenario() + start_simulation()
▼ [RUNNING]
◄──────────────────────────────────────────────────┐
│ operator: pause()
│ operator: resume()
│
▼
▼
│ [PAUSED] ──────────────► [RUNNING] operator: branch()
│
│
operator: stop()
│
▼
│ [SHUTTING_DOWN] ──── teardown complete ──► [OFFLINE]
│
│
│
▼
│ [FAULT]
──── checkpoint available ──► [RECOVERING] ──────────┘
──── no
checkpoint ──────────► [OFFLINE]

Every state transition is atomically logged to the AuditLogger before the transition completes. Pre-flight
checks (executed in the WARMING_UP→READY transition) include:

● GPU driver version and extension support verification
● Sovereign network isolation validation (no external routes reachable)
● Module manifest hash verification against registry
● TPM attestation measurement comparison
● Available VRAM and system RAM budget check against configured requirements
● Shader cache integrity check (SPIR-V binary hashes)

8.2 Scenario Management
Scenarios are the primary unit of simulation configuration. Each scenario is defined by a YAML manifest
file stored in the sovereign enclave's scenario store at
/srv/ptdt/scenarios/{scenario_id}/manifest.yaml.
# Example scenario manifest scenario_id:
"structural_load_test_alpha_20260715" display_name:
"Alpha Frame Structural
Load Test — Rev. 4" version:
"2.1.0" created_by:
"tucker.a@tristate.eng" created_at:
"2026-07-15T05:25:00-05:00" parent_scenario:
"structural_load_test_alpha_20260610" # branched from physics:
gravity:
[0.0, -9.807, 0.0]
rng_seed:
847291034
timestep_hz:
120
substeps:
4 scene:
asset_pack:
"industrial_structural_v3"
environment:
"industrial_daylight_overcast"
entities:
"entities/alpha_frame_rev4.json" telemetry:
channels:
- id:
"node.A3.stress_mpa"
source:
"physics.rigid_body.entity:alpha_frame.node_A3"
metric:
"von_mises_stress"
unit:
"MPa"
rate_hz: 1000

Scenarios support branching and merging analogous to version control. A branch creates a new scenario
with the current scenario as its parent; the branch inherits all configuration and the current checkpoint
state. Merging (currently unidirectional: branch→parent) applies a diff of changed configuration fields
back to the parent scenario manifest, subject to conflict detection.

8.3 Asset Pipeline Workflow
Raw engineering assets (CAD exports, material textures, audio cues, environment HDRIs) are processed
through the asset pipeline before runtime use:

23. Import: Raw asset uploaded via REST API (/api/v1/assets/upload). Supported formats:
GLTF 2.0, FBX, OBJ (geometry); PNG/EXR (textures); WAV (audio); HDR/EXR (environment
maps).

24. Validation: Asset format validation, malware scan (via sovereign ClamAV instance), polygon
budget check, and texture resolution limit enforcement.

25. Processing: Geometry: weld vertices, compute normals/tangents, optimize index order (Forsyth
algorithm). Textures: mipmap generation, BC7 compression (color/normal), BC6H (HDR), ASTC
for ARM64 targets.

26. LOD Generation: Automatic LOD generation using progressive meshes (quadric error metric
simplification) for LOD1–LOD4 from the source LOD0 mesh. LOD generation runs as a
background job; asset is available for use at LOD0 immediately upon processing completion.

27. Streaming Cache Registration: Processed asset registered in the AssetManager's streaming
cache catalogue. Assets are streamed from disk on demand using io_uring for low-latency async
I/O.

28. Runtime Load: At scenario load, referenced assets are pre-fetched into the streaming cache.
During simulation, missing assets trigger async background loads with an LOD4 placeholder until
the full asset is available.

8.4 Snapshot and Replay
The platform's snapshot system captures complete, deterministic simulation state for replay validation,
incident investigation, and scenario branching.

8.4.1 Snapshot Format
A snapshot is a PTDT Snapshot Archive (.ptsa), a structured binary container comprising:

● Snapshot manifest (JSON): metadata, scenario ID, tick counter, wall clock timestamp, platform
version, signing key fingerprint

● Physics state block: all rigid body positions, velocities, orientations; soft body particle positions;
fluid particle positions and velocities; thermal grid temperatures; EM field potentials

● SceneGraph state block: all entity transforms, component states, material property overrides
● StateManager state block: FSM state, pending transition queue, operator session state
● RNG state block: Xoshiro256++ generator state for all physics worker threads
● Cryptographic signature: Ed25519 signature over the content hash, signed by the platform key
(HSM-backed)

8.4.2 Replay Validation
To validate a snapshot replay: load the snapshot, run the simulation forward for N ticks (default 1,000
ticks), and compare the resulting state against a pre-recorded golden reference state. Hash comparison
is performed on the serialized physics state block. Any discrepancy is reported as a determinism
violation and logged as a Critical audit event.

8.5 Operator Runbook
Procedure

Steps

Estimated
Time

Platform
Launch

1. Verify secure boot attestation (TPM console). 2. Login as operator (OIDC). 3.
Execute ptdt-launch --scenario {id}. 4. Monitor pre-flight output. 5.
Confirm READY state in HUD status bar.

Cold start:
<45 s

Normal
Monitoring

Monitor HUD alert queue, telemetry readouts, and performance overlay.
Respond to WARNING alerts within 5 min; CRITICAL within 1 min.

Ongoing

Emergency
Stop

1. Press Ctrl+Shift+Esc or execute POST /api/v1/simulation/stop . 2.
Confirm SHUTTING_DOWN state. 3. Verify OFFLINE state reached. 4. File
incident report.

<10 s to
initiate

Graceful
Shutdown

1. Execute POST /api/v1/simulation/stop . 2. Wait for OFFLINE state. 3.
Verify audit log flushed. 4. Execute ptdt-shutdown.

<30 s

Incident
Response

1. Record incident timestamp and observable symptoms. 2. Capture snapshot (if
simulation still running). 3. Execute emergency stop if safety-impacting. 4.
Export audit log segment. 5. Notify Platform Engineering.

Per incident

8.6 Upgrade and Patching Workflow
Upgrades are classified by scope and the required patch procedure:

Patch Type

Scope

Downtime
Required

Procedure

Rollback

Hot-Patch

Shader SPIR-V,
configuration files,
theme files

None (live
reload)

Operator uploads new file via API;
hot-reload watcher applies within
one frame (dev) or next restart
(prod)

Re-upload
previous
version

Warm-Patch

Individual module
shared library (.so),
no API change

<8 s
(warm
restart)

Stop simulation → replace .so →
warm restart (modules reload, state
restored from last checkpoint)

Restore
previous .so;
warm restart

Cold-Patch

Platform core, HAL,
kernel module, API
version change

<45 s (cold
restart)

Full platform shutdown → apply
package update → cold start from
checkpoint

Restore
previous
package; cold
start

OS/Firmware
Patch

Linux kernel, GPU
driver, TPM
firmware

Full reboot
required

Schedule maintenance window →
shutdown platform → apply OS
update → reboot → verify
attestation → cold start

Restore OS
snapshot;
reboot

8.7 Disaster Recovery
The platform's disaster recovery design centers on the state checkpointing system:

● Checkpoint Interval: Configurable; default 60 seconds during active simulation. Reduced to 10
seconds if the health monitor detects elevated error rates.

● Checkpoint Storage: Checkpoints are stored as signed .ptsa snapshot files in the local
checkpoint store (/srv/ptdt/checkpoints/). The 10 most recent checkpoints are retained;
older ones are archived or purged per the operator's retention policy.

● Recovery Procedure: Upon detecting a crash (watchdog heartbeat timeout), the supervisor
process automatically locates the most recent valid (signature-verified) checkpoint, loads it, and
restarts the simulation in RECOVERING state. Target RTO: <30 seconds from crash detection to
RUNNING state.

● Checkpoint Integrity: Each checkpoint is signed by the platform key (Ed25519, HSM-backed).
The supervisor verifies the signature before loading; a tampered or corrupt checkpoint is
skipped in favor of the next most recent valid checkpoint.

8.8 Multi-Operator Collaboration

Multiple credentialed operators may connect to the same simulation session simultaneously.
Collaboration is governed by the following rules:

● Session Locking: Simulation control commands (start, stop, reset) require an exclusive session
lock. Only the lock holder may issue control commands; other operators may observe. Locks are
automatically released after a configurable idle timeout (default: 10 minutes).

● Change Attribution: All scene configuration changes, scenario parameter edits, and command
executions are attributed to the issuing operator's identity in the AuditLogger. Anonymized or
impersonated actions are rejected.

● Conflict Resolution: Concurrent edits to the same scenario parameter by different operators are
detected by optimistic locking (version counter on each config field). The second writer receives
a CONFLICT_409 error and must reload the current state before retrying.

● Observer Mode: Operators without the session lock may view all telemetry, the 3D viewport,
and the audit log in real time, but cannot issue control commands.

8.9 CI/CD Integration
The platform's CI/CD pipeline is implemented in a sovereign Bazel + Jenkins (or GitLab CI) configuration
with the following stages:

Stage

Trigger

Actions

Gate Criteria

Build

Every commit

Hermetic Bazel build of all modules; SPIR-V
shader compilation; SBOM generation

Zero build errors; SBOM
generated

Unit Tests

Every commit

Run all unit test targets (bazel test
//tests/unit/...); coverage report

100% pass; >85% line
coverage

Integration
Tests

Every commit

Launch simulator in headless mode; run
integration test suite

100% pass; no
ASAN/UBSAN errors

Determinism
Tests

Nightly

Cross-instance replay comparison; run same
scenario on 4 platform instances; compare
state hashes

Bit-exact state hash match
across all instances

Perf
Benchmarks

Nightly

Automated benchmark suite; compare
against baseline; generate regression report

No benchmark regression
>5%

Security Scan

Weekly / on
dependency
change

Dependency CVE scan (SBOM); static analysis
(clang-tidy, Semgrep); binary hardening
checks

No CRITICAL/HIGH CVEs
unwaived; clang-tidy clean

Stage

Trigger

Actions

Gate Criteria

Simulation
Regression

On release
branch

Full simulation regression suite (50 canonical
scenarios); physics validation against
analytical references

All scenarios complete;
physics error within
tolerance

Deployment
Gate

Release
approval

SARB sign-off; final SBOM review; attestation
measurement update in Golden Registry

SARB approval recorded in
AuditLogger

9. Security and Sovereignty Model
9.1 Sovereign Platform Definition
The PTDT v32 platform is defined as sovereign in the following precise engineering sense: it is a selfcontained operational system that processes, stores, and transmits simulation data exclusively within an
operator-controlled physical and network perimeter, with no mandatory dependency on any external
service, cloud provider, CDN, telemetry endpoint, or third-party licensing infrastructure. The platform
MUST remain fully functional with all external network interfaces disabled.

■ Sovereignty Compliance Assertion
No code path within PTDT v32 may make an outbound network connection to an
address outside the operator's designated sovereign enclave VLAN, including but
not limited to: crash reporting services, license verification servers, auto-update
endpoints, analytics telemetry, or CDN-hosted assets. Violations discovered during
code review or security audit are treated as Critical defects requiring immediate
remediation before release.

9.2 Threat Model

Threat Actor

Threat Scenario

Mitigations

Insider
Threat

Credentialed operator exfiltrates
simulation data or modifies scenario
configuration maliciously

RBAC least-privilege; AuditLogger with tamperevident log; session locking; data egress blocking;
multi-person approval for destructive actions

Supply Chain
Attack

Malicious code introduced via a
compromised third-party dependency

SBOM with SHA-256 content hashing; sovereign
Artifact Registry; Supply Chain Review (SCR) process;
source-code-only dependency policy

Network
Intrusion

Attacker gains access to the enclave
VLAN and attempts lateral movement
or data exfiltration

mTLS service mesh (no plaintext internal traffic);
network segmentation; deny-all-egress firewall;
IDS/IPS on VLAN gateway

Physical
Access

Attacker with physical access to the
server attempts to boot modified OS
or extract data from storage

TPM 2.0 measured boot; UEFI Secure Boot; full-disk
encryption (AES-256-XTS); chassis intrusion detection;
HSM for key material (tamper-evident hardware)

Privilege
Escalation

Compromised service process
attempts to escalate to root or access
other module's memory

Least-privilege POSIX users per module; seccomp-BPF
syscall filtering; Linux namespaces; AppArmor profiles
per service

Replay /
Tampering

Attacker replays or modifies captured
API messages

Message envelope HMAC-SHA256; TLS 1.3 with
session tickets; timestamp validation (reject messages
>30 s old); nonce per request

9.3 Secure Boot Chain
The secure boot chain establishes a hardware-rooted chain of trust from power-on to application
execution:

29. UEFI Secure Boot: Only signed EFI bootloader accepted. Platform keys managed by Tri-State
Engineering's PKI. Third-party UEFI key databases are cleared at provisioning.

30. TPM 2.0 Measured Boot: Each boot stage (UEFI firmware, bootloader, Linux kernel, initramfs,
platform services) is measured (SHA-256 hash) into TPM Platform Configuration Register (PCR)
banks 0–15 per the TCG measured boot specification.

31. Attestation Verification: At platform startup, the PTDT boot agent reads the TPM PCR values
and compares them against the Golden Measurement Registry (stored as a signed JSON file
managed by the SARB). If any PCR value deviates from the golden record, startup is aborted with
incident code BOOT-ATTEST-FAIL, and an out-of-band alert is dispatched to the Security
Operations contact.

32. HSM Unlock: Upon successful attestation, the HSM releases the platform's root encryption key
to the key management service, enabling decryption of the platform's encrypted configuration
and credential stores.

9.4 Encryption
Data Category

Algorithm

Key Length

Notes

Data at Rest (disk)

AES-256-XTS (dmcrypt/LUKS2)

256-bit

Full-disk encryption; key derived via
Argon2id KDF from HSM-released root
key

Snapshot archives
(.ptsa)

AES-256-GCM

256-bit

Per-snapshot data encryption key (DEK),
wrapped by HSM KEK

In-transit (service
mesh)

TLS 1.3 (AES-256-GCM
/ ChaCha20-Poly1305)

256-bit

mTLS enforced; TLS 1.2 and below
disabled on all listeners

Audit log

AES-256-GCM (perblock) + Ed25519
signing

256-bit / 256bit

Each log block encrypted and signed;
Merkle-tree chain for integrity

Credential store

AES-256-GCM with
HSM-managed KEK

256-bit

Operator passwords stored as Argon2id
hashes; API keys stored as HMAC-SHA256
hashes

Platform signing
(snapshots, modules)

Ed25519

256-bit
(curve25519)

Private keys never leave the HSM; signing
is performed via HSM PKCS#11 API

9.5 Key Management
All cryptographic key material is managed by the platform's Key Management Service (KMS),
implemented in Rust (§3.1, security/keymgmt/), backed by a hardware HSM compliant with FIPS
140-2 Level 3 or higher.

● Key Hierarchy: Root Key (HSM-protected, never exported) → Platform Master Key (encrypted
by Root Key, stored in HSM) → Data Encryption Keys (DEKs, generated per-use, wrapped by
Platform Master Key).

● Key Rotation Policy: Platform Master Key: annual rotation, plus immediate rotation on any
suspected compromise (incident code SEC-KEY-ROT). DEKs: rotated per-snapshot (for data at
rest) and per-session (for TLS). mTLS certificates: 90-day rotation (automated).

● Key Destruction: On platform decommissioning, the HSM administrator executes a certified key
destruction procedure. All DEKs encrypted under the destroyed master key become
irrecoverable, rendering the associated data permanently inaccessible.

9.6 Access Control
The PTDT v32 platform implements Role-Based Access Control (RBAC) with four defined roles, following
least-privilege assignment:

Role

Permissions

Typical Assignee

Operator

Start/stop/pause simulation; load/save scenarios; view telemetry and
audit log (read-only); take snapshots; operator HUD access

Simulation operators,
field engineers

Engineer

All Operator permissions + upload/modify assets; edit scenario manifests;
access developer overlay tools; configure telemetry channels; issue
warm-patch operations

Platform engineers,
simulation
developers

Admin

All Engineer permissions + manage users and roles; issue cold-patch and
OS-patch operations; manage API keys; configure security settings; access
all REST API endpoints

Platform
administrators,
system architects

Auditor

Read-only access to audit log, security events, access control
configuration, and SBOM. Cannot modify any platform state.

Security auditors,
compliance officers

9.7 Audit Logging
The AuditLogger (Rust implementation, §3.3) maintains an append-only, tamper-evident log of all
platform events. Tamper evidence is provided by a Merkle-tree hash chain: each log block contains the
SHA-256 hash of the previous block, forming an unbreakable chain. The current Merkle root is signed by
the platform key (Ed25519, HSM) every 60 seconds and stored in the Golden Measurement Registry.
Audit events are exported to the sovereign SIEM on a push schedule (every 10 seconds). The SIEM
export channel is an authenticated, encrypted gRPC stream (mTLS). If the SIEM is unreachable, events
buffer locally for up to 24 hours; if the local buffer exceeds capacity, a Critical alert is raised and the
operator must acknowledge before simulation continues.

9.8 Vulnerability Management

● Quarterly Security Review: Full review of the platform codebase by the
Platform Security team, including penetration testing of the REST API surface
and authentication system.
● Dependency Scanning: SBOM is scanned against the NVD CVE database on
every build. New CVEs matching platform dependencies trigger automated alerts
to the Platform Security team within 1 hour of NVD publication.
● CVE Triage SLA:
○ CRITICAL (CVSS ≥ 9.0): Patch or waiver required within 7 days.
○ HIGH (CVSS 7.0–8.9): Patch or waiver required within 30 days.
○ MEDIUM (CVSS 4.0–6.9): Patch in next scheduled release cycle (<90
days).
○ LOW / INFO: Tracked and addressed in subsequent minor releases.
● Static Analysis: clang-tidy with the platform's custom security rule profile runs
on every CI build. Semgrep with the C++/Rust security rule sets runs on every
pull request. New security rule violations block merge.

10. Performance Targets and SLAs
10.1 Simulation Tick Rates
Subsystem

Target Rate

Period

Jitter
Tolerance

Overrun Policy

Physics Solver (rigid
body, soft body, fluid
SPH)

120 Hz

8.333 ms

±0.1 ms (RT
thread)

Emit overrun event; log to
AuditLogger; 3 consecutive overruns
→ watchdog escalation

Thermal Solver (FD
grid)

60 Hz

16.67 ms

±0.5 ms

Skip tick if overloaded; catch up next
tick (accumulator pattern)

EM Field Solver (quasistatic)

10 Hz

100 ms

±5 ms

Non-critical; skip tick if load too high;
emit warning after 5 consecutive
skips

Subsystem

Target Rate

Period

Jitter
Tolerance

Overrun Policy

Rendering (3D scene +
UI)

60 fps

16.67 ms

±1 ms

Automatic LOD downgrade on
sustained overrun; VSync adaptive
fallback to 30 fps

Telemetry Sampling

1 Hz – 1 kHz
(per-channel)

1 ms – 1
s

Per-channel
configurable

Downsample to configured rate;
timestamp-correct for postprocessing

Backend Event Bus

Up to 500k
events/s peak

—

—

Back-pressure to producer; queue
depth alert at 80% capacity

State Checkpointing

1/60 s (every
60 s)

60 s

±2 s

Retry failed checkpoint; alert after 3
consecutive failures

10.2 Frame Time Budget
Reference hardware: NVIDIA RTX 4090 (24 GB VRAM) or AMD RX 7900 XTX (24 GB VRAM); Intel Core
i9-14900K or AMD Ryzen 9 7950X (16-core); 64 GB DDR5-6000 system RAM.

Component

Budget
(ms)

Measurement Point

Alert Threshold

Physics→Render state copy (ring buffer
read)

0.10

CPU

>0.25 ms

Frustum culling + draw call batching

0.80

CPU

>1.5 ms

Vulkan command buffer recording

0.60

CPU (multi-threaded)

>1.2 ms

G-Buffer Pass

3.50

GPU timestamp

>5.0 ms

Shadow Map Pass

2.00

GPU timestamp

>3.0 ms

SSAO Pass

0.80

GPU timestamp

>1.5 ms

Lighting Pass

2.50

GPU timestamp

>3.5 ms

Volumetric Pass

1.20

GPU timestamp

>2.0 ms

TAA Pass

0.60

GPU timestamp

>1.0 ms

Post-Processing Pass

1.20

GPU timestamp

>2.0 ms

UI Composite Pass

0.80

GPU timestamp

>1.5 ms

Swapchain Present + Driver Overhead

0.80

CPU

>1.5 ms

Total Frame Budget

14.90

—

>16.67 ms (missed
frame)

10.3 Memory Budget

Resource

Budget

Notes

System RAM — Total

32 GB

Platform requires 64 GB host RAM; simulator is allocated 32 GB
of that headroom

System RAM — Physics Solver

8 GB

Rigid body data, soft body particles, SPH particles, thermal/EM
grids

System RAM — Simulation
Kernel

6 GB

SceneGraph, StateManager, EventDispatcher queues, scenario
data

System RAM — Asset
Streaming Cache

12 GB

LRU streaming cache for decoded mesh and texture data
awaiting GPU upload

System RAM — Backend Bus
Buffers

4 GB

Ingest ring buffers, telemetry export queues, Kafka producer
buffers

VRAM — Total (Primary GPU)

24 GB

NVIDIA RTX 4090 / AMD RX 7900 XTX reference GPU

VRAM — Static Geometry Pool

8 GB

VMA-managed; scenario geometry and static LOD meshes

VRAM — Texture / Image Pool

12 GB

Includes G-Buffer RTs, shadow maps, environment maps, scene
textures

VRAM — Dynamic Frame Pool

2 GB

Per-frame CBs, dynamic meshes, physics debug geometry (×3
triple-buffered)

VRAM — Staging Pool

2 GB

CPU→GPU upload staging, persistently mapped

10.4 Startup and Recovery Targets
Metric

Target

Measurement Condition

Cold Start Time

<45 seconds

From ptdt-launch invocation to READY state; empty shader cache;
full asset load

Warm Start Time

<8 seconds

From warm restart (modules reloaded); shader cache populated; state
from checkpoint

Scenario Load Time

<15 seconds

From scenario load command to first rendered frame; 10,000-entity
scene, 8 GB asset pack

Crash Recovery
RTO

<30 seconds

From watchdog crash detection to RUNNING state restored from most
recent checkpoint

Snapshot Write
Time

<2 seconds

Full physics + scene state snapshot to signed .ptsa file; reference scene
size

Snapshot Load
Time

<5 seconds

Load and verify signed .ptsa; restore physics + scene state; resume
simulation

10.5 Throughput and Latency SLAs

SLA Metric

Target

Measurement Method

UI Input-to-Render
Latency

<5 ms at 60 fps

Hardware timestamp from input event reception to
corresponding pixel update on display

Backend Bus Peak
Throughput

500k events/sec
sustained

Automated load test with synthetic event generator;
measured over 60-second window

Sensor Feed Ingest
Latency

<2 ms (99th percentile)

Timestamp delta from sensor feed arrival at BackendBus
to physics state application

Telemetry Export Lag

<100 ms at 1 kHz
sampling

Delta between physics tick timestamp and corresponding
InfluxDB write confirmation

Snapshot Signature
Verification

<50 ms

Ed25519 signature verification over snapshot content
hash (HSM-backed, PCIe HSM required)

API Response Time
(95th pct.)

<200 ms for control
endpoints

Measured from TLS session establishment to HTTP
response body completion

Audit Log Write Latency

<1 ms (99th percentile)

From event emission to confirmed append-only write;
does not include SIEM export time

11. Testing and Validation
11.1 Test Pyramid
The PTDT v32 test strategy follows a four-tier test pyramid. Tests are organized under tests/ in the
monorepo and run via Bazel test targets:

Tier

Scope

Count
Target

Run
Frequency

Tools

Unit

Individual classes,
functions, algorithms in
isolation (mocked
dependencies)

>3,000
test
cases

Every
commit

Google Test 1.14, Google Mock

Integration

Module-to-module
interaction; IPC roundtrips; database writes and
reads; API endpoint
behavior

>400 test
cases

Every
commit

Google Test, Catch2 3.6, custom
headless simulator harness

System

Full platform startup and
shutdown; end-to-end
simulation run; REST API

>80 test
scenarios

Daily
(nightly
build)

Headless simulator; Python test
orchestrator; custom API test client

Tier

Scope

Count
Target

Run
Frequency

Tools

50
canonical
scenarios

On
release
branch;
weekly on
main

PTDT regression harness
(tools/regression/run_suite.py )

surface validation; security
controls

Simulation
Regression

50+ canonical engineering
scenarios run to
completion; state hash
comparison against golden
references; performance
benchmarks

★ Coverage Policy
All new code submitted to the
platform/physics/
and
platform/render/
namespaces MUST achieve ≥90% line coverage via unit or integration tests. All
new code in other platform namespaces MUST achieve ≥80% line coverage.
Coverage is measured by LLVM's
llvm-cov
and reported per-module in the CI pipeline dashboard.

11.2 Determinism Test Suite
The determinism test suite validates bit-exact reproducibility across platform instances. It is executed
nightly as part of the CI pipeline and on every release branch:

33. Instance Setup: Four identical platform instances (same OS image, same hardware
configuration) are provisioned in the test cluster.

34. Scenario Execution: All four instances load the same signed scenario snapshot and advance the
simulation for 10,000 physics ticks (approximately 83.3 seconds at 120 Hz).

35. State Hash Comparison: At tick 10,000, each instance serializes the full physics state block to a
canonical binary format and computes its SHA-256 hash. The four hashes are compared; bitexact match across all instances is required.

36. Cross-Run Comparison: The tick-10,000 state hash is also compared against the golden
reference hash stored in the determinism test database. Any deviation from the golden hash is
treated as a determinism regression and blocks CI.

37. Reported Metrics: Per-run: pass/fail, state hash, tick count, test duration. Trend: hash stability
across the last 30 nightly runs (any hash change indicates a non-deterministic code change).

11.3 Physics Validation
Physics accuracy is validated against analytical solutions and external FEA benchmarks:

Test Case

Method

Acceptance Criterion

Projectile motion
(vacuum)

Compare to analytical ballistic equations
over 10 s

Position error <0.1 mm at t=10 s

Spring-mass oscillator
(undamped)

Compare to analytical SHM; measure
energy conservation

Total energy drift <0.01% over 100
oscillation cycles

Rigid body collision
(elastic)

Verify conservation of momentum and
kinetic energy (elastic case)

Momentum conserved to 6 decimal
places; KE conserved ±0.01%

Cantilever beam
deflection

Euler-Bernoulli beam theory; compare
with ANSYS FEA reference

Tip deflection within 1% of analytical;
within 2% of FEA

SPH dam-break scenario

Compare height profile to experimental
data (Martin & Moyce 1952)

Surge front position within 5% of
experimental at t=0.5 s

Thermal rod diffusion
(1D)

Compare to analytical Fourier series
solution

Temperature error <0.1 K at all grid
points at t=60 s

PBD cloth under gravity

Compare equilibrium sag to catenary
curve

Sag profile within 2% of catenary at 20
uniformly spaced points

11.4 Rendering Validation
Rendering output correctness is validated using golden frame comparison:

● Golden Frame Database: A set of 120 reference scenes (each rendering a canonical engineering
scene from a fixed camera position with fixed lighting) is maintained. Each golden frame is a 16bit PNG rendered at 1920×1080 using the last validated release build.

● Pixel-Level Diff Test: The current build renders each reference scene. The rendered frame is
compared pixel-by-pixel against the golden frame using RMSE. Acceptance criterion: RMSE <1.5
per-channel (out of 65535 for 16-bit output). Perceptual diff (SSIM) must be >0.997.

● TAA Stability Test: Run each reference scene for 64 frames; the final converged frame is
compared against the golden. This validates TAA convergence behavior and ghosting absence.

● Shader Correctness Tests: Individual shader units are tested in isolation using GPU compute test
harnesses that validate BRDF evaluation, CSM split math, SSAO sample distribution, and HDR
tone mapping against CPU reference implementations.

11.5 Performance Benchmarks
Automated performance benchmarks run nightly and on release branches:

● Physics Throughput Benchmark: Run 10,000 physics ticks of the reference stress-test scenario
(5,000 rigid bodies, 20,000 soft body particles, 30,000 SPH particles). Measure average tick
execution time; must remain ≤8.0 ms (120 Hz budget).

● Rendering Benchmark: Render 1,000 frames of the reference scene at 3840×2160. Measure
average GPU frame time per pass (via timestamp queries). Compare against per-pass budgets
(§10.2). Any pass exceeding its budget by >10% generates a regression alert.

● Backend Throughput Benchmark: Inject synthetic events at 600k events/sec for 60 seconds.
Measure sustained throughput, tail latency (99th percentile), and queue depth. Must sustain
≥500k events/sec with <2 ms 99th percentile latency.

● Memory Benchmark: Run the full platform for 30 minutes with the reference scenario. Measure
peak system RAM and VRAM usage. Must remain within budget (§10.3). Any trend of >50
MB/min growth rate triggers a memory leak investigation.

● Regression Alerting: Benchmark results are written to InfluxDB and compared against a 7-day
rolling baseline. A regression of >5% on any benchmark metric triggers an automated alert to
the Platform Engineering team Slack channel and blocks the release pipeline.

11.6 Fault Injection Testing

The platform's resilience mechanisms are validated through fault injection testing, executed quarterly
and before major releases:

Fault Scenario

Injection Method

Expected Behavior

Acceptance Criterion

Physics tick
overrun

Inject artificial delay
in physics solver via
test hook

Watchdog escalation after 3
consecutive overruns; LOD
downgrade applied

Overrun event emitted;
AuditLogger entry; LOD
downgrade within 3 frames

GPU out-ofmemory

Exhaust VMA pools
via test allocation;
trigger real OOM

Streaming cache eviction; alert to operator HUD; graceful
degradation (not crash)

Module crash
(PhysicsEngine)

SIGKILL PhysicsEngine
process via test
supervisor

Watchdog detects heartbeat
timeout (<2 s); triggers FAULT state;
checkpoint restore initiated

RTO <30 s; simulation
resumed from checkpoint;
no data corruption

Network
partition (SIEM
unreachable)

Block gRPC port to
SIEM via iptables rule

AuditLogger buffers events locally;
alert raised after 10 s; simulation
continues

No events lost; events
exported when connectivity
restored; operator alerted

Disk full
(checkpoint
store)

Fill checkpoint
partition to 100% via
test file

Checkpoint failure alert; operator
notified; simulation continues; LRU
eviction of oldest checkpoints

Critical alert emitted; no
crash; oldest checkpoint
evicted to recover space

Corrupted
snapshot

Modify 1 byte in a
.ptsa file; attempt
load

Ed25519 signature verification fails;
snapshot rejected; next most
recent checkpoint used

Tampered snapshot never
loaded; appropriate audit
event emitted

Unauthorized
API call

Issue REST API call
with invalid/expired
token

401 Unauthorized response;
attempt logged in AuditLogger; no
state change

Zero successful
unauthorized operations;
100% of attempts logged

11.7 Module Acceptance Criteria
Each module MUST satisfy the following acceptance criteria before being marked release-ready:

Module

Acceptance Criteria

HAL

Initializes on all supported hardware configurations; GPU context created with all required
extensions; CPU topology correctly reported; all unit tests pass

SimCore

Module lifecycle correctly sequenced (all 5 phases); watchdog correctly detects and escalates
module timeouts; state machine transitions logged; all integration tests pass

PhysicsEngine

All physics validation tests pass (§11.3); determinism test suite pass; 120 Hz tick budget
sustained for 30 min reference scenario; no ASAN/UBSAN errors

RenderEngine

All golden frame tests pass (RMSE <1.5, SSIM >0.997); frame budget sustained at 4K 60fps for
10 min; no Vulkan validation layer errors in dev build

UIFramework

All widget interaction tests pass; WCAG 2.1 AA contrast check passes for all themes; layout
benchmark <0.5 ms for 200-node widget tree; no input event drops

Module

Acceptance Criteria

BackendBus

500k events/sec throughput benchmark passes; all authentication tests pass (valid + invalid
token scenarios); egress blocking verified; all schema evolution tests pass

AssetManager

All supported import formats load correctly; LOD generation produces correct simplification
ratios; streaming eviction operates within VRAM budget; no resource leaks

AuditLogger

All audit events written within 1 ms 99th percentile; Merkle-tree chain verifiable with
independent tool; tampered log correctly detected; SIEM export verified

StateManager

All defined state transitions executed correctly; invalid transitions rejected; every transition
logged; recovery from checkpoint restores correct state

SceneGraph

Spatial queries (AABB, ray, frustum) return correct results for all test scenes; dirty propagation
correct; no stale transform data after 1,000 random update sequences

12. Glossary and Acronym Table
Term /
Acronym

Full Form

Definition

AABB

Axis-Aligned Bounding Box

A rectangular bounding volume whose faces are parallel to
the coordinate axes; used for broad-phase collision detection
and spatial queries.

ACES

Academy Color Encoding
System

An industry-standard color management and tone mapping
system; used in the post-processing pass for HDR-to-SDR
tone mapping.

API

Application Programming
Interface

A defined interface for software components to
communicate.

ASTC

Adaptive Scalable Texture
Compression

A GPU texture compression format used for ARM64 targets.

AuditLogger

—

The PTDT v32 sovereign audit trail module (Rust
implementation); maintains an append-only, Merkle-treeintegrity-protected log of all platform events.

BC6H / BC7

Block Compression 6H / 7

GPU texture compression formats for HDR (BC6H) and highquality LDR color + normal (BC7) data on x86_64 targets.

BVH

Bounding Volume Hierarchy

A tree data structure over geometric objects using bounding
volumes for efficient spatial queries; used for broad-phase
collision detection.

CSM

Cascaded Shadow Maps

A shadow mapping technique that partitions the view
frustum into multiple depth ranges (cascades), each with a
separate shadow map for improved resolution distribution.

Term /
Acronym

Full Form

Definition

DEK

Data Encryption Key

A symmetric encryption key used to encrypt specific data
objects; encrypted by a Key Encryption Key (KEK) for storage.

DOF

Degrees of Freedom

The number of independent parameters that define the state
of a physical system.

ECR

Engineering Change Request

Formal process for proposing and approving changes to a
released engineering specification or platform component.

EPA

Expanding Polytope Algorithm

A narrow-phase collision algorithm that computes
penetration depth and contact normal from the result of GJK;
used in the PhysicsEngine rigid body solver.

FEA

Finite Element Analysis

A numerical method for solving partial differential equations
over complex geometries by discretizing into finite elements;
used as a reference for physics validation.

FIPS

Federal Information
Processing Standards

U.S. government security standards; FIPS 140-2/3 defines
security requirements for cryptographic modules.

FSM

Finite State Machine

A computational model with a finite number of states and
defined transitions between them; governs the PTDT v32
simulation lifecycle in the StateManager.

GJK

Gilbert-Johnson-Keerthi
Algorithm

A narrow-phase collision detection algorithm for computing
the minimum distance between convex shapes; used in the
PhysicsEngine.

HAL

Hardware Abstraction Layer

The lowest platform layer; abstracts CPU topology, GPU
context, memory allocation, and I/O interfaces from higher
layers.

HMAC

Hash-based Message
Authentication Code

A cryptographic MAC computed using a hash function and a
secret key; used to authenticate API requests and message
envelopes in PTDT v32.

HSM

Hardware Security Module

A dedicated tamper-resistant hardware device for
cryptographic key generation, storage, and operations; used
to protect the PTDT v32 platform's root keys.

HUD

Heads-Up Display

An operator-facing real-time information overlay rendered by
the UIFramework over the 3D simulation viewport.

HZB

Hierarchical Z-Buffer

A multi-resolution depth buffer mip-chain used for GPUaccelerated occlusion culling; built from the previous frame's
depth buffer.

IBL

Image-Based Lighting

A rendering technique using pre-filtered environment map
images to approximate ambient and specular lighting from
the environment; part of the PBR lighting pass.

ICU

International Components for
Unicode

A C/C++ library providing Unicode and globalization support;
used in the UIFramework for localization, number/date
formatting, and RTL text layout.

IDS/IPS

Intrusion
Detection/Prevention System

Network security appliances that monitor traffic for malicious
activity.

Term /
Acronym

Full Form

Definition

IPC

Inter-Process Communication

Mechanisms allowing processes to exchange data; in PTDT
v32: shared memory ring buffers, io_uring zero-copy, and the
EventDispatcher.

KEK

Key Encryption Key

A cryptographic key used to encrypt Data Encryption Keys
(DEKs) for secure storage.

LOD

Level of Detail

A technique that uses lower-complexity representations of
objects when they are far from the camera, reducing
rendering cost.

LRU

Least Recently Used

A cache eviction policy that removes the item not accessed
for the longest time; used in the AssetManager streaming
cache.

MAC

Marker-and-Cell (grid solver
context); Message
Authentication Code (security
context)

Grid topology for fluid simulation velocity storage (staggered
arrangement); or a cryptographic function for verifying
message integrity and authenticity.

mTLS

Mutual TLS

A TLS protocol extension where both client and server
authenticate with certificates; used for all service-to-service
communication in the PTDT v32 internal service mesh.

NDT

Non-Destructive Testing

Engineering inspection methods (e.g., eddy current,
ultrasound) that evaluate material properties without causing
damage; simulated by the EM field model.

OIDC

OpenID Connect

An identity layer on top of OAuth 2.0; used for human
operator authentication in PTDT v32.

PBD

Position-Based Dynamics

A physics simulation method that directly manipulates
particle positions to satisfy geometric constraints; used for
soft body simulation in the PhysicsEngine.

PBR

Physically-Based Rendering

A rendering approach that simulates how light interacts with
materials based on physical principles; uses GGX-Smith BRDF
in PTDT v32.

PCF

Percentage-Closer Filtering

A shadow map filtering technique that samples multiple
depth comparisons and averages the results for soft shadow
edges.

PCG

Preconditioned Conjugate
Gradient

An iterative linear solver for sparse symmetric positive
definite systems; used in the grid-based fluid pressure solver.

PCR

Platform Configuration
Register

A set of registers in a TPM that accumulate cryptographic
measurements of the boot process; used for attestation.

PTDT

Platform for Trusted
Deterministic Telemetry

The Tri-State Engineering sovereign simulation platform;
PTDT v32 is the current major version.

RBAC

Role-Based Access Control

An access control model where permissions are assigned to
roles and roles are assigned to users; PTDT v32 defines four
roles: Operator, Engineer, Admin, Auditor.

Term /
Acronym

Full Form

Definition

RFC 2119

—

IETF standard defining normative language (MUST, SHOULD,
MAY) for technical specifications.

RMSE

Root Mean Square Error

A statistical measure of error magnitude; used in rendering
validation to compare pixel-level differences.

RT

Real-Time (thread scheduling
context)

A scheduling policy where thread execution deadlines are
guaranteed by the OS; PTDT v32 uses PREEMPT_RT Linux for
physics threads.

RTO

Recovery Time Objective

The maximum acceptable time to restore normal operation
after a failure; PTDT v32 crash RTO is <30 seconds.

SARB

Systems Architecture Review
Board

The Tri-State Engineering governing body responsible for
approving architectural changes, security models, and release
deployments.

SBOM

Software Bill of Materials

A formal inventory of all software components, libraries, and
dependencies in a software product; PTDT v32 SBOM is
generated in CycloneDX 1.5 format.

SCR

Supply Chain Review

The PTDT v32 process for approving the addition or
modification of third-party dependencies.

SDF

Signed Distance Field

A representation of geometric shapes (especially font glyphs)
as a field of signed distances; enables scalable, high-quality
rendering of text and vector shapes at arbitrary sizes.

SHM

Shared Memory

A memory region accessible by multiple processes; used in
PTDT v32 for high-bandwidth physics→render state transfer
via ring buffers.

SIEM

Security Information and
Event Management

A security system that collects, aggregates, and analyzes
security event logs; PTDT v32 AuditLogger exports to a
sovereign SIEM via authenticated gRPC.

SIMD

Single Instruction, Multiple
Data

A CPU instruction set extension for parallel data processing;
PTDT v32 uses AVX2 for physics math and frustum culling.

SPH

Smoothed-Particle
Hydrodynamics

A mesh-free particle-based fluid simulation method; used in
the PhysicsEngine for localized fluid effects.

SPIR-V

Standard Portable
Intermediate Representation
— Vulkan

A binary intermediate representation for GPU shaders used
by Vulkan; PTDT v32 compiles all shaders to SPIR-V at build
time.

SSAO

Screen-Space Ambient
Occlusion

A rendering technique that approximates ambient occlusion
(contact shadows and crevice darkening) in screen space.

SSIM

Structural Similarity Index
Measure

A perceptual image quality metric; used in rendering
validation alongside RMSE.

TAA

Temporal Anti-Aliasing

An anti-aliasing technique that accumulates samples across
multiple frames with reprojection to produce smooth, stable
imagery.

Term /
Acronym

Full Form

Definition

TPM

Trusted Platform Module

A hardware security chip providing cryptographic
measurement, attestation, and key storage; PTDT v32
requires TPM 2.0 for secure boot chain.

UEFI

Unified Extensible Firmware
Interface

The modern firmware interface for PC boot; PTDT v32
requires UEFI Secure Boot to establish the hardware root of
trust.

VMA

Vulkan Memory Allocator

An open-source C++ library (AMD GPUOpen) for GPU
memory management in Vulkan applications; version 3.1.0
used in PTDT v32.

WCAG

Web Content Accessibility
Guidelines

An international standard for accessibility; PTDT v32
UIFramework targets WCAG 2.1 Level AA compliance.

XPBD

Extended Position-Based
Dynamics

A physically consistent extension of PBD that introduces
compliance parameters to decouple constraint stiffness from
solver iteration count.

YAML

YAML Ain't Markup Language

A human-readable data serialization format; used for
scenario manifests in PTDT v32.

ZMQ

ZeroMQ

A high-performance asynchronous messaging library; one of
two supported BackendBus transport options in PTDT v32.

Document Footer — Tri-State Engineering Division
Document ID: TSE-PTDT-v32-SPS-001 | Version: v1.0.0 | Date: July 15, 2026
Classification: Internal — Engineering Confidential | Prepared by: Tri-State Engineering
Division — Platform Engineering Group
This document is the property of Tri-State Engineering Division. Unauthorized reproduction
or distribution is prohibited. For questions regarding this specification, contact the Platform
Engineering Group via the sovereign internal ticketing system.

