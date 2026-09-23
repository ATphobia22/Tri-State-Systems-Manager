cmake_minimum_required(VERSION 3.24)

project(ArchimedesCore LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(ARCHIMEDES_ENABLE_SANITIZERS "Enable address/undefined behavior sanitizers" OFF)

add_library(ArchimedesCore SHARED
    src/ArchimedesNative.cpp
)

target_include_directories(ArchimedesCore PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_compile_definitions(ArchimedesCore PRIVATE ARCHIMEDESCORE_BUILD)

if(MSVC)
    target_compile_options(ArchimedesCore PRIVATE /W4 /permissive- /EHsc)
    if(ARCHIMEDES_ENABLE_SANITIZERS)
        add_compile_options(/fsanitize=address)
        add_link_options(/fsanitize=address)
    endif()
else()
    target_compile_options(ArchimedesCore PRIVATE -Wall -Wextra -Wpedantic -Wconversion)
    if(ARCHIMEDES_ENABLE_SANITIZERS)
        add_compile_options(-fsanitize=address,undefined -fno-omit-frame-pointer)
        add_link_options(-fsanitize=address,undefined)
    endif()
endif()

include(CTest)
if(BUILD_TESTING)
    add_executable(ArchimedesCoreTests tests/ArchimedesNativeTests.cpp)
    target_link_libraries(ArchimedesCoreTests PRIVATE ArchimedesCore)
    add_test(NAME ArchimedesCoreTests COMMAND ArchimedesCoreTests)
endif()
