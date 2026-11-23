import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'search'
})
export class SearchPipe implements PipeTransform {

  transform(recipes: any[] | null | undefined, searchKey: string | null | undefined): any[] {
    if (!recipes) {
      return [];
    }
    const key = (searchKey ?? '').toString().trim().toLowerCase();
    if (!key) {
      return recipes;
    }
    return recipes.filter((item: any) => (item?.name ?? '').toString().toLowerCase().includes(key));
  }

}
