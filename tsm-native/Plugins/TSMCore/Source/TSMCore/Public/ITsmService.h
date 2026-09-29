#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Service-registry contract: modules publish named services, consumers resolve them.
class ITsmService {
public:
    virtual ~ITsmService() = default;
    virtual const char* ServiceName() const = 0;
};
class ITsmServiceRegistry {
public:
    virtual ~ITsmServiceRegistry() = default;
    virtual bool Register(const char* name, ITsmService* service) = 0;
    virtual ITsmService* Resolve(const char* name) = 0;
};
