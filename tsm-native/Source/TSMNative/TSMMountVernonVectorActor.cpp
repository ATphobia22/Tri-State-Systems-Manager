#include "TSMMountVernonVectorActor.h"
#include "Components/SplineComponent.h"

ATSMMountVernonVectorActor::ATSMMountVernonVectorActor()
{
    PrimaryActorTick.bCanEverTick = false;
    Footprint = CreateDefaultSubobject<USplineComponent>(TEXT("GeospatialSpline"));
    SetRootComponent(Footprint);
    Footprint->SetClosedLoop(false);
    Tags.AddUnique(FName(TEXT("TSM_MV_MANAGED")));
}
