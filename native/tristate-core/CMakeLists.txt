cmake_minimum_required(VERSION 3.20)
project(TriStateSystemsManager VERSION 2.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

option(TSSM_BUILD_EXAMPLES "Build end-to-end demo_app" ON)
option(TSSM_BUILD_TESTS "Build unit tests" ON)

if(MSVC)
    add_compile_options(/W4 /permissive- /sdl)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -fstack-protector-strong -O2)
    add_compile_definitions(_FORTIFY_SOURCE=2)
endif()

add_library(tristate_core STATIC src/api/api_wrapper.cpp)
target_include_directories(tristate_core
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
        $<INSTALL_INTERFACE:include>
)

add_library(tristate_shared SHARED src/api/api_wrapper.cpp)
target_include_directories(tristate_shared
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
        $<INSTALL_INTERFACE:include>
)
set_target_properties(tristate_shared PROPERTIES OUTPUT_NAME tristate)

if(TSSM_BUILD_TESTS)
    enable_testing()
    add_executable(unit_tests tests/test_state_machine.cpp)
    target_include_directories(unit_tests PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    )
    target_link_libraries(unit_tests PRIVATE tristate_core)
    if(UNIX AND NOT APPLE)
        target_link_libraries(unit_tests PRIVATE pthread)
    endif()
    add_test(NAME StateMachineTests COMMAND unit_tests)
endif()

if(TSSM_BUILD_EXAMPLES)
    add_executable(demo_app examples/demo_app.cpp)
    target_link_libraries(demo_app PRIVATE tristate_core)
    target_include_directories(demo_app PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/include)
endif()

install(TARGETS tristate_core tristate_shared
    ARCHIVE DESTINATION lib
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin
)
install(FILES include/tristate_manager.h DESTINATION include)
install(DIRECTORY include/tristate DESTINATION include)
