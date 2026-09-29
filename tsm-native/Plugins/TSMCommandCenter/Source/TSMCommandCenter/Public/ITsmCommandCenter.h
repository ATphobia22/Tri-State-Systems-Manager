#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Command center: operations dashboard, incident command, decision support,
// monitoring. Technology informs people; it does not silently govern people.
// Human authority remains final over every recommendation surfaced here.
#include <cstdint>

enum class TsmAlertSeverity : uint8_t
{
    Info = 0,
    Watch = 1,
    Warning = 2,
    Critical = 3,
};

struct TsmAlert
{
    TsmAlertSeverity severity;
    char title[128];
    char detail[512];
    // 'unknown' when data is missing — never silently interpolated.
    char confidence[16];
};

class ITsmCommandCenter
{
public:
    virtual ~ITsmCommandCenter() = default;
    virtual bool PublishAlert(const TsmAlert& alert) = 0;
    virtual bool AcknowledgeAlert(const char* alertId, const char* operatorName) = 0;
    // Decision-support snapshot: returns a JSON document describing current
    // incident state. Advisory only; not a directive.
    virtual bool GetSituationSnapshot(const char* outJsonPath) = 0;
};
