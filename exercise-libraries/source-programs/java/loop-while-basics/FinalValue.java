/*
@codescope
@title Track the value after exit
@seed step min=1 max=2
@seed limit min=5 max=7
*/
public class FinalValue {
    public static void main(String[] args) {
        int value = 1;
        int step = 2;
        int limit = 6;

        while (value < limit) {
            System.out.println("advance toward limit");
            value += step;
            System.out.println("new value ready");
        }

        System.out.println("final " + value);
    }
}

