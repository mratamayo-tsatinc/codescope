/*
 * @codescope
 * @title Cube Volume Finder
 * @bug id=bug-1 line=1 token=1 correct="#" wrong="&" choices="&|%"
 * @bug id=bug-2 line=3 token=2 correct="main" wrong="Main" choices="Main|man"
 * @bug id=bug-3 line=7 token=6 correct="side" wrong="Side" choices="Side|sides"
 * @bug id=bug-4 line=8 token=8 correct=";" wrong=":" choices=":|,"
 * @bug id=bug-5 line=9 token=7 correct=";" wrong=":" choices=":|,"
 * @bug id=bug-6 line=10 token=1 correct="return" wrong="RETURN" choices="RETURN|Return"
 */
#include <stdio.h>

int main()
{
    int side, volume;
    printf("Side: ");
    scanf("%d", &side);
    volume = side * side * side;
    printf("Volume: %d", volume);
    return 0;
}
