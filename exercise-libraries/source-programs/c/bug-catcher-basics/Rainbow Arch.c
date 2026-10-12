/*
 * @codescope
 * @title Rainbow Arch
 * @bug id=bug-1 line=1 token=4 correct="stdio" wrong="studio" choices="studio|std"
 * @bug id=bug-2 line=5 token=1 correct="printf" wrong="Printf" choices="Printf|print"
 * @bug id=bug-3 line=6 token=1 correct="printf" wrong="Printf" choices="Printf|print"
 * @bug id=bug-4 line=7 token=1 correct="printf" wrong="Printf" choices="Printf|print"
 */
#include <stdio.h>

int main()
{
    printf("            Green\n");
    printf("      Yellow     Brown\n");
    printf("  Orange             Indigo\n");
    printf("Red                      Violet\n");
    return 0;
}
