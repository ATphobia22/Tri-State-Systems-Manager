#include "TSMGeoSplineActor.h"

ATSMGeoSplineActor::ATSMGeoSplineActor()
{
    PrimaryActorTick.bCanEverTick = false;
    GeometrySpline = CreateDefaultSubobject<USplineComponent>(TEXT("GeometrySpline"));
    RootComponent = GeometrySpline;
    GeometrySpline->SetClosedLoop(false);
    SetCanBeDamaged(false);
}
