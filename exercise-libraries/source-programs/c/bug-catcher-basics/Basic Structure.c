/*
 * @codescope
 * @title Basic Structure
 * @bug id=bug-1 line=4 token=1 correct="{" wrong="}" choices="}|)"
 * @bug id=bug-2 line=7 token=1 correct="}" wrong="{" choices="{|)"
 */
#include <stdio.h>

int main()
{
    printf("End of Activity\n");
    return 0;
}
