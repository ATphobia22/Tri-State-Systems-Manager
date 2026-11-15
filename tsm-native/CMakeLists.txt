cmake_minimum_required(VERSION 3.22)
project(TSMNative CXX)

# IDE-only wrapper (CLion / VS Code / clangd). UnrealBuildTool remains the real builder.
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(
	"${CMAKE_CURRENT_SOURCE_DIR}/Source/TSMNative/Public"
	"${CMAKE_CURRENT_SOURCE_DIR}/Source/TSMNative"
)

file(GLOB_RECURSE TSM_SOURCES
	"Source/TSMNative/Public/*.h"
	"Source/TSMNative/Private/*.cpp"
	"Source/TSMNative/*.h"
	"Source/TSMNative/*.cpp"
)

if(TSM_SOURCES)
	add_library(TSMNative STATIC ${TSM_SOURCES})
else()
	message(STATUS "TSMNative: no Public/Private sources found yet — placeholder target for IDE indexing")
	add_library(TSMNative INTERFACE)
endif()
