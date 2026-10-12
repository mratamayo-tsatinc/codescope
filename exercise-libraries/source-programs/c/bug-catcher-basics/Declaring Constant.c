/*
 * @codescope
 * @title Declaring Constant
 * @bug id=bug-1 line=5 token=1 correct="const" wrong="constant" choices="constant|final"
 * @bug id=bug-2 line=5 token=6 correct=";" wrong=":" choices=":|,"
 */
#include <stdio.h>

int main()
{
    const float PI = 3.14159;
    float radius = 5.0;
    float area = PI * radius * radius;
    return 0;
}
