cmake_minimum_required(VERSION 3.24)

project(ArchimedesCore LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(ArchimedesCore SHARED
    src/ArchimedesNative.cpp
)

target_include_directories(ArchimedesCore
    PUBLIC
        \${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_definitions(ArchimedesCore PRIVATE ARCHIMEDESCORE_BUILD)

if(MSVC)
    target_compile_options(ArchimedesCore PRIVATE /W4 /permissive- /EHsc)
else()
    target_compile_options(ArchimedesCore PRIVATE -Wall -Wextra -Wpedantic -Wconversion)
endif()
