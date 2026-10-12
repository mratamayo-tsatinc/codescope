/*
 * @codescope
 * @title Escape Characters
 * @bug id=bug-1 line=1 token=2 correct="include" wrong="INCLUDE" choices="INCLUDE|import"
 */
#include <stdio.h>

int main()
{
    printf("Loading file: C:\\nodes\\program.exe");
    return 0;
}
