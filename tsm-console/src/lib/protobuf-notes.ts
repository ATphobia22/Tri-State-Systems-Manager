/**
 * Protocol Buffers alignment for Evidence Plane
 *
 * Schema: proto/evidence_artifact.proto
 * Runtime: @bufbuild/protobuf (after `buf generate` / protoc-gen-es)
 *
 * Until codegen is wired in CI, JSON Schema remains the interchange format.
 * Binary protobuf is reserved for high-volume worker ↔ API traffic.
 */

export const PROTOBUF_PACKAGE = 'tsm.evidence.v1';
export const PROTO_PATH = 'proto/evidence_artifact.proto';
export const RECOMMENDED_STACK = {
  messages: '@bufbuild/protobuf',
  rpc: '@connectrpc/connect (optional future)',
  validate: '@bufbuild/protovalidate (optional)',
} as const;
