cmake_minimum_required(VERSION 3.20)
project(TriStateSystemsManager VERSION 2.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if(MSVC)
    add_compile_options(/W4 /permissive- /sdl)
else()
    add_compile_options(
        -Wall
        -Wextra
        -Wpedantic
        -fstack-protector-strong
        -O2
    )
    add_compile_definitions(_FORTIFY_SOURCE=2)
endif()

add_library(tristate_core STATIC
    src/api/api_wrapper.cpp
)
target_include_directories(tristate_core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)

add_library(tristate_shared SHARED
    src/api/api_wrapper.cpp
)
target_include_directories(tristate_shared
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)

enable_testing()
add_executable(unit_tests
    tests/test_state_machine.cpp
)
target_include_directories(unit_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)
target_link_libraries(unit_tests PRIVATE tristate_core)
if(UNIX AND NOT APPLE)
    target_link_libraries(unit_tests PRIVATE pthread)
endif()
add_test(NAME StateMachineTests COMMAND unit_tests)
