"""Runtime protobuf contract for the TSM OpenMI transport profile.

Canonical schema: tsm-console/proto/openmi.proto.
This module builds the same descriptors at runtime so the Python bridge does
not require checked-in protoc output.
"""

from __future__ import annotations

from google.protobuf import descriptor_pb2, descriptor_pool, message_factory

_PACKAGE = "tsm.openmi.v1"
_FILE_NAME = "tsm/openmi/v1/openmi.proto"


def _field(message, name, number, field_type, *, repeated=False, type_name=None):
    field = message.field.add()
    field.name = name
    field.number = number
    field.type = field_type
    field.label = (
        descriptor_pb2.FieldDescriptorProto.LABEL_REPEATED
        if repeated
        else descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL
    )
    if type_name:
        field.type_name = type_name


def _build_file_descriptor():
    file = descriptor_pb2.FileDescriptorProto()
    file.name = _FILE_NAME
    file.package = _PACKAGE
    file.syntax = "proto3"

    spatial = file.message_type.add()
    spatial.name = "SpatialReference"
    _field(spatial, "horizontal_crs", 1, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(spatial, "vertical_datum", 2, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(spatial, "horizontal_units", 3, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(spatial, "vertical_units", 4, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)

    quantity = file.message_type.add()
    quantity.name = "QuantityValueSet"
    _field(quantity, "quantity_id", 1, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "units", 2, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "values", 3, descriptor_pb2.FieldDescriptorProto.TYPE_DOUBLE, repeated=True)
    _field(quantity, "timestamp", 4, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "source_provenance_hash", 5, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "source_component", 6, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "target_component", 7, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "model_run_id", 8, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "element_ids", 9, descriptor_pb2.FieldDescriptorProto.TYPE_STRING, repeated=True)
    _field(quantity, "spatial_reference", 10, descriptor_pb2.FieldDescriptorProto.TYPE_MESSAGE, type_name=".%s.SpatialReference" % _PACKAGE)
    _field(quantity, "source_authority", 11, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "software_version", 12, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "model_version", 13, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(quantity, "validation_status", 14, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)

    component = file.message_type.add()
    component.name = "ComponentInfo"
    _field(component, "component_id", 1, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(component, "component_type", 2, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(component, "implementation", 3, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(component, "input_quantities", 4, descriptor_pb2.FieldDescriptorProto.TYPE_STRING, repeated=True)
    _field(component, "output_quantities", 5, descriptor_pb2.FieldDescriptorProto.TYPE_STRING, repeated=True)
    _field(component, "software_version", 6, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(component, "model_version", 7, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)

    request = file.message_type.add()
    request.name = "ExchangeRequest"
    _field(request, "component_id", 1, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(request, "model_run_id", 2, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)

    response = file.message_type.add()
    response.name = "ExchangeResponse"
    _field(response, "accepted", 1, descriptor_pb2.FieldDescriptorProto.TYPE_BOOL)
    _field(response, "message", 2, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(response, "server_time", 3, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)

    file.message_type.add().name = "HealthRequest"

    health = file.message_type.add()
    health.name = "HealthResponse"
    _field(health, "status", 1, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(health, "service_version", 2, descriptor_pb2.FieldDescriptorProto.TYPE_STRING)
    _field(health, "registered_components", 3, descriptor_pb2.FieldDescriptorProto.TYPE_UINT32)

    service = file.service.add()
    service.name = "OpenMIService"

    method = service.method.add()
    method.name = "Exchange"
    method.input_type = ".%s.QuantityValueSet" % _PACKAGE
    method.output_type = ".%s.QuantityValueSet" % _PACKAGE
    method.client_streaming = True
    method.server_streaming = True

    method = service.method.add()
    method.name = "RegisterComponent"
    method.input_type = ".%s.ComponentInfo" % _PACKAGE
    method.output_type = ".%s.ExchangeResponse" % _PACKAGE

    method = service.method.add()
    method.name = "Health"
    method.input_type = ".%s.HealthRequest" % _PACKAGE
    method.output_type = ".%s.HealthResponse" % _PACKAGE

    return file.SerializeToString()


DESCRIPTOR = descriptor_pool.Default().AddSerializedFile(_build_file_descriptor())

SpatialReference = message_factory.GetMessageClass(DESCRIPTOR.message_types_by_name["SpatialReference"])
QuantityValueSet = message_factory.GetMessageClass(DESCRIPTOR.message_types_by_name["QuantityValueSet"])
ComponentInfo = message_factory.GetMessageClass(DESCRIPTOR.message_types_by_name["ComponentInfo"])
ExchangeRequest = message_factory.GetMessageClass(DESCRIPTOR.message_types_by_name["ExchangeRequest"])
ExchangeResponse = message_factory.GetMessageClass(DESCRIPTOR.message_types_by_name["ExchangeResponse"])
HealthRequest = message_factory.GetMessageClass(DESCRIPTOR.message_types_by_name["HealthRequest"])
HealthResponse = message_factory.GetMessageClass(DESCRIPTOR.message_types_by_name["HealthResponse"])
