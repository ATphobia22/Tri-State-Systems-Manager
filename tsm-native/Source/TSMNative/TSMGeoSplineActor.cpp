#include "TSMGeoSplineActor.h"

ATSMGeoSplineActor::ATSMGeoSplineActor()
{
    PrimaryActorTick.bCanEverTick = false;
    GeometrySpline = CreateDefaultSubobject<USplineComponent>(TEXT("GeometrySpline"));
    RootComponent = GeometrySpline;
    GeometrySpline->SetClosedLoop(false);
    SetCanBeDamaged(false);
}

USplineComponent* ATSMGeoSplineActor::AddInteriorRingSpline()
{
    Modify();
    auto* Ring = NewObject<USplineComponent>(this, NAME_None, RF_Transactional);
    Ring->SetupAttachment(GeometrySpline);
    AddInstanceComponent(Ring);
    Ring->RegisterComponent();
    InteriorRingSplines.Add(Ring);
    return Ring;
}
