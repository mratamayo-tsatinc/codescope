/*
@codescope
@title Stock Reorder
@seed stock min=4 max=14
@seed reorderLevel min=8 max=12
@seed reorderBatch min=15 max=25 step=5
*/
#include <stdio.h>

int main(void)
{
    int stock = 7;
    int reorderLevel = 10;
    int reorderBatch = 20;
    int incoming = 0;

    if (stock < reorderLevel) {
        incoming = reorderBatch;
    }

    printf("INVENTORY NOTICE\n");
    printf("Incoming stock: %d units\n", incoming);
    printf("Projected stock: %d units\n", stock + incoming);

    return 0;
}

